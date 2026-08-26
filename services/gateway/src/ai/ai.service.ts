import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SkillsService } from '../skills/skills.service';
import { GenerateDto } from '../apps/apps.dto';
import { effectiveDailyGenerations } from '../quota.util';
import { ProviderRouter } from './providers/provider.router';
import type { AppSpec, StreamTokenFn } from './providers/provider.types';

export type GenerateClientResult = {
  requestId: string;
  status: 'SUCCEEDED' | 'REFUSED' | 'FAILED';
  skillsApplied: string[];
  spec?: AppSpec;
  reply?: string;
  provider?: string;
  refusal?: string;
  message?: string;
};

type TurnContext = {
  userId: string;
  dto: GenerateDto;
  started: number;
  requestId: string;
  skillsApplied: string[];
  skillsBlock: string;
  generationId: string;
  currentSpec: AppSpec;
};

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly skills: SkillsService,
    private readonly providers: ProviderRouter,
    private readonly config: ConfigService,
  ) {}

  /**
   * Starts a turn (quota, skills, generation row). Safe to call before SSE headers.
   *
   * @example
   * const ctx = await aiService.beginGenerate(userId, dto);
   */
  async beginGenerate(userId: string, dto: GenerateDto): Promise<TurnContext> {
    const started = Date.now();
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { quota: true },
    });
    const quota = user.quota;
    if (!quota) {
      throw new HttpException('quota missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    if (dto.prompt.length > quota.maxPromptChars) {
      throw new HttpException('prompt too large', HttpStatus.PAYLOAD_TOO_LARGE);
    }

    const used = await this.redis.incrDaily('generations', userId);
    const dailyLimit = effectiveDailyGenerations(
      quota.dailyGenerations,
      this.config,
    );
    if (used > dailyLimit && user.role !== UserRole.ADMIN) {
      throw new HttpException('daily generation quota exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (dto.appId) {
      const owned = await this.prisma.app.findFirst({
        where: { id: dto.appId, ownerId: userId },
      });
      if (!owned) {
        throw new NotFoundException('app not found');
      }
    }

    const loaded = await this.skills.loadForPrompt();
    const requestId = randomUUID();
    const providerName = this.providers.activeName();
    const generation = await this.prisma.generation.create({
      data: {
        requestId,
        userId,
        appId: dto.appId,
        draftId: dto.draftId,
        prompt: dto.prompt,
        skillsApplied: loaded.names,
        skillsHash: loaded.hash,
        status: 'RUNNING',
        provider: providerName,
      },
    });

    const existingDraft = dto.appId
      ? await this.prisma.draft.findFirst({
          where: dto.draftId
            ? { id: dto.draftId, appId: dto.appId }
            : { appId: dto.appId },
          orderBy: { revision: 'desc' },
        })
      : null;
    const currentSpec =
      existingDraft?.specJson && typeof existingDraft.specJson === 'object'
        ? (existingDraft.specJson as AppSpec)
        : {};

    return {
      userId,
      dto,
      started,
      requestId,
      skillsApplied: loaded.names,
      skillsBlock: loaded.block,
      generationId: generation.id,
      currentSpec,
    };
  }

  /**
   * Streams the French reply then persists the spec.
   *
   * @example
   * const out = await aiService.streamGenerate(ctx, (delta) => write(delta), signal);
   */
  async streamGenerate(
    ctx: TurnContext,
    onToken: StreamTokenFn,
    signal?: AbortSignal,
  ): Promise<GenerateClientResult> {
    const hard = this.detectHardRefusal(ctx.dto.prompt);
    if (hard) {
      await this.prisma.generation.update({
        where: { id: ctx.generationId },
        data: {
          status: 'REFUSED',
          refusalReason: hard,
          durationMs: Date.now() - ctx.started,
        },
      });
      onToken(hard);
      return {
        requestId: ctx.requestId,
        status: 'REFUSED',
        skillsApplied: ctx.skillsApplied,
        reply: hard,
        refusal: hard,
      };
    }

    let result;
    try {
      result = await this.providers.generateStream(
        {
          skillsBlock: ctx.skillsBlock,
          prompt: ctx.dto.prompt,
          currentSpec: ctx.currentSpec,
        },
        onToken,
        signal,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'provider error';
      await this.prisma.generation.update({
        where: { id: ctx.generationId },
        data: {
          status: 'FAILED',
          refusalReason: message,
          durationMs: Date.now() - ctx.started,
        },
      });
      return {
        requestId: ctx.requestId,
        status: 'FAILED',
        skillsApplied: ctx.skillsApplied,
        message,
      };
    }

    if (result.refusal) {
      await this.prisma.generation.update({
        where: { id: ctx.generationId },
        data: {
          status: 'REFUSED',
          refusalReason: result.refusal,
          provider: result.provider,
          model: result.model,
          durationMs: Date.now() - ctx.started,
        },
      });
      return {
        requestId: ctx.requestId,
        status: 'REFUSED',
        skillsApplied: ctx.skillsApplied,
        reply: result.refusal,
        refusal: result.refusal,
        provider: result.provider,
      };
    }

    const spec = result.spec;
    await this.prisma.$transaction([
      this.prisma.generation.update({
        where: { id: ctx.generationId },
        data: {
          status: 'SUCCEEDED',
          resultSpec: spec as Prisma.InputJsonValue,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          provider: result.provider,
          model: result.model,
          durationMs: Date.now() - ctx.started,
        },
      }),
      this.prisma.usageRecord.create({
        data: {
          userId: ctx.userId,
          generationId: ctx.generationId,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          estimatedCostUsd: 0,
        },
      }),
      ...(ctx.dto.appId
        ? [
            this.prisma.app.update({
              where: { id: ctx.dto.appId },
              data: {
                status: 'DRAFT',
                ...(spec.app?.name ? { name: spec.app.name } : {}),
              },
            }),
          ]
        : []),
    ]);

    if (ctx.dto.appId) {
      const draft = ctx.dto.draftId
        ? await this.prisma.draft.findFirst({
            where: { id: ctx.dto.draftId, appId: ctx.dto.appId },
          })
        : await this.prisma.draft.findFirst({
            where: { appId: ctx.dto.appId },
            orderBy: { revision: 'desc' },
          });
      if (draft) {
        await this.prisma.draft.update({
          where: { id: draft.id },
          data: { specJson: spec as Prisma.InputJsonValue },
        });
      }
    }

    return {
      requestId: ctx.requestId,
      status: 'SUCCEEDED',
      skillsApplied: ctx.skillsApplied,
      spec,
      reply: result.reply,
      provider: result.provider,
    };
  }

  private detectHardRefusal(prompt: string): string | null {
    const lower = prompt.toLowerCase();
    const banned = ['keylogger', 'ransomware', 'phishing kit', 'csam'];
    for (const term of banned) {
      if (lower.includes(term)) {
        return `refused by gateway policy (${term})`;
      }
    }
    return null;
  }
}
