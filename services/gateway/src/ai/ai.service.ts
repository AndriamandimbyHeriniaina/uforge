import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SkillsService } from '../skills/skills.service';
import { effectiveDailyGenerations } from '../quota.util';
import { GenerateDto } from './generate.dto';
import { buildRetryText, buildTurnParts, contextChars } from './prompt/build-prompt';
import { UfStreamParser, type UfOpEvent } from './protocol/uf-parser';
import {
  applyOps,
  diffFiles,
  type FileChange,
  type OpFailure,
  type WorkspaceFiles,
} from './protocol/workspace';
import { ProviderRouter } from './providers/provider.router';
import { IMAGE_MIMES, type LlmMessage, type LlmProvider } from './providers/provider.types';

export type TurnStatus = 'SUCCEEDED' | 'REFUSED' | 'FAILED';

/** Payload of the final `done` SSE event. */
export type DonePayload = {
  requestId: string;
  status: TurnStatus;
  reply: string;
  changes: FileChange[];
  usage: { inputTokens: number; outputTokens: number };
  provider: string;
  model: string;
  /** French explanation when status is FAILED. */
  message?: string;
};

export type TurnEmitter = {
  token: (text: string) => void;
  op: (event: UfOpEvent) => void;
};

export type TurnContext = {
  userId: string;
  dto: GenerateDto;
  started: number;
  requestId: string;
  generationId: string;
  skillsBlock: string;
  skillsApplied: string[];
  provider: LlmProvider;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly skills: SkillsService,
    private readonly providers: ProviderRouter,
    private readonly config: ConfigService,
  ) {}

  /**
   * Checks quota and sizes, loads the skills, records the turn. Runs before the
   * SSE headers so errors stay plain JSON.
   *
   * @example
   * const ctx = await ai.beginTurn(userId, dto);
   */
  async beginTurn(userId: string, dto: GenerateDto): Promise<TurnContext> {
    const started = Date.now();
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { quota: true },
    });
    const quota = user.quota;
    if (!quota) {
      throw new HttpException('quota missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    if (dto.message.length > quota.maxPromptChars) {
      throw new HttpException('message too long', HttpStatus.PAYLOAD_TOO_LARGE);
    }
    if (contextChars(dto) > quota.maxContextChars) {
      throw new HttpException('project too large for this plan', HttpStatus.PAYLOAD_TOO_LARGE);
    }
    for (const attachment of dto.attachments ?? []) {
      if (attachment.kind === 'image') {
        if (!IMAGE_MIMES.includes(attachment.mime as (typeof IMAGE_MIMES)[number])) {
          throw new HttpException(`unsupported image type ${attachment.mime}`, HttpStatus.BAD_REQUEST);
        }
        const bytes = Math.floor(((attachment.dataBase64 ?? '').length * 3) / 4);
        if (bytes > quota.maxFileBytes) {
          throw new HttpException('attachment too large', HttpStatus.PAYLOAD_TOO_LARGE);
        }
      }
    }

    const used = await this.redis.incrDaily('generations', userId);
    const dailyLimit = effectiveDailyGenerations(quota.dailyGenerations, this.config);
    if (used > dailyLimit && user.role !== UserRole.ADMIN) {
      throw new HttpException('daily generation quota exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    const loaded = await this.skills.loadForPrompt();
    if (!loaded.block.trim()) {
      throw new ServiceUnavailableException('skills deposit is empty');
    }
    let provider: LlmProvider;
    try {
      provider = this.providers.active();
    } catch (err) {
      throw new ServiceUnavailableException(err instanceof Error ? err.message : 'no provider');
    }

    const requestId = randomUUID();
    const generation = await this.prisma.generation.create({
      data: {
        requestId,
        userId,
        appId: dto.appId,
        prompt: dto.message.slice(0, 8000),
        skillsApplied: loaded.names,
        skillsHash: loaded.hash,
        status: 'RUNNING',
        provider: provider.id,
      },
    });

    return {
      userId,
      dto,
      started,
      requestId,
      generationId: generation.id,
      skillsBlock: loaded.block,
      skillsApplied: loaded.names,
      provider,
    };
  }

  /**
   * Streams one turn: chat text → `token`, file operations → `op`. Applies the
   * operations to the received workspace (one corrective retry), atomically.
   *
   * @example
   * const done = await ai.runTurn(ctx, { token, op }, signal);
   */
  async runTurn(ctx: TurnContext, emit: TurnEmitter, signal?: AbortSignal): Promise<DonePayload> {
    const original: WorkspaceFiles = {};
    for (const file of ctx.dto.files ?? []) {
      original[file.path] = file.content;
    }
    const assets = new Set((ctx.dto.assets ?? []).map((asset) => asset.path));
    const firstMessage: LlmMessage = { role: 'user', parts: buildTurnParts(ctx.dto) };
    let inputTokens = 0;
    let outputTokens = 0;
    let model = '';

    const finish = async (
      status: TurnStatus,
      reply: string,
      changes: FileChange[],
      message?: string,
    ): Promise<DonePayload> => {
      await this.record(ctx, status, { inputTokens, outputTokens, model }, changes, message);
      return {
        requestId: ctx.requestId,
        status,
        reply,
        changes,
        usage: { inputTokens, outputTokens },
        provider: ctx.provider.id,
        model,
        ...(message ? { message } : {}),
      };
    };

    try {
      const parser = new UfStreamParser({ onText: emit.token, onOp: emit.op });
      const first = await ctx.provider.stream(
        { system: ctx.skillsBlock, messages: [firstMessage] },
        (delta) => parser.push(delta),
        signal,
      );
      inputTokens += first.inputTokens;
      outputTokens += first.outputTokens;
      model = first.model;
      const parsed = parser.finish();

      if (parsed.refusal || first.stopReason === 'refusal') {
        const reply =
          parsed.refusal ??
          'Je ne peux pas réaliser cette demande. Essaie de la formuler autrement.';
        if (!parsed.refusal && !parsed.text) {
          emit.token(reply);
        }
        return finish('REFUSED', reply, [], parsed.refusal ?? `refusal (${first.refusalCategory ?? 'model'})`);
      }

      const applied = applyOps(original, parsed.ops, assets);
      let files = applied.files;
      const failures: OpFailure[] = [...applied.failures, ...fileProblems(parsed.problems)];
      for (const problem of parsed.problems) {
        if (!problemPath(problem)) {
          this.logger.warn(`turn ${ctx.requestId}: ${problem}`);
        }
      }

      if (failures.length > 0) {
        this.logger.warn(`turn ${ctx.requestId}: retrying ${failures.length} failed operation(s)`);
        const retryParser = new UfStreamParser({ onOp: emit.op });
        const retry = await ctx.provider.stream(
          {
            system: ctx.skillsBlock,
            messages: [
              firstMessage,
              { role: 'assistant', parts: [{ type: 'text', text: first.text || '(empty)' }] },
              { role: 'user', parts: [{ type: 'text', text: buildRetryText(failures, files) }] },
            ],
          },
          (delta) => retryParser.push(delta),
          signal,
        );
        inputTokens += retry.inputTokens;
        outputTokens += retry.outputTokens;
        const retryParsed = retryParser.finish();
        const second = applyOps(files, retryParsed.ops, assets);
        const remaining = [...second.failures, ...fileProblems(retryParsed.problems)];
        const fixed = new Set(retryParsed.ops.map((op) => (op.kind === 'rename' ? op.from : op.path)));
        const unresolved = failures.filter((failure) => !fixed.has(failure.path));
        if (remaining.length > 0 || unresolved.length > 0 || retryParsed.ops.length === 0) {
          const detail = [...remaining, ...unresolved]
            .map((failure) => `${failure.path} : ${failure.reason}`)
            .join(' ; ');
          return finish(
            'FAILED',
            parsed.text,
            [],
            `Je n’ai pas réussi à appliquer mes modifications (${detail}). Rien n’a été changé, réessaie ou reformule.`,
          );
        }
        files = second.files;
      }

      const changes = diffFiles(original, files);
      const reply = parsed.text || (changes.length ? 'C’est fait.' : '');
      return finish('SUCCEEDED', reply, changes);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'provider error';
      this.logger.error(`turn ${ctx.requestId} failed: ${reason}`);
      return finish(
        'FAILED',
        '',
        [],
        signal?.aborted
          ? 'Tour interrompu.'
          : `Le service d’IA n’a pas répondu correctement (${reason}). Réessaie dans un instant.`,
      );
    }
  }

  private async record(
    ctx: TurnContext,
    status: TurnStatus,
    usage: { inputTokens: number; outputTokens: number; model: string },
    changes: FileChange[],
    message?: string,
  ): Promise<void> {
    try {
      await this.prisma.generation.update({
        where: { id: ctx.generationId },
        data: {
          status,
          model: usage.model || null,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          changedPaths: changes.map((change) => change.path),
          refusalReason: status === 'SUCCEEDED' ? null : (message ?? null),
          durationMs: Date.now() - ctx.started,
          ...(status !== 'FAILED' || usage.outputTokens > 0
            ? {
                usage: {
                  create: {
                    userId: ctx.userId,
                    inputTokens: usage.inputTokens,
                    outputTokens: usage.outputTokens,
                    estimatedCostUsd: 0,
                  },
                },
              }
            : {}),
        },
      });
    } catch (err) {
      this.logger.error(`could not record turn ${ctx.requestId}: ${String(err)}`);
    }
  }
}

function problemPath(problem: string): string | null {
  const match = / for (\S+)$/.exec(problem);
  return match?.[1] ?? null;
}

/** Protocol problems tied to a file (truncated write, empty edit) count as failures. */
function fileProblems(problems: string[]): OpFailure[] {
  return problems.flatMap((problem) => {
    const path = problemPath(problem);
    return path ? [{ path, reason: problem }] : [];
  });
}
