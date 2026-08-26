import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SkillsService } from '../skills/skills.service';
import { GenerateDto } from '../apps/apps.dto';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly skills: SkillsService,
  ) {}

  /**
   * Runs one Builder generation: reload skills from disk, enforce quota,
   * persist a Generation row, then call the provider stub (real adapters later).
   *
   * @example
   * const result = await aiService.generate(userId, {
   *   prompt: 'I want a stock app with a barcode camera',
   *   appId,
   * });
   */
  async generate(userId: string, dto: GenerateDto) {
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
    if (used > quota.dailyGenerations && user.role !== UserRole.ADMIN) {
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
        provider: 'stub',
        model: 'hforge-stub-v0',
      },
    });

    const refusal = this.detectHardRefusal(dto.prompt, loaded.block);
    if (refusal) {
      await this.prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'REFUSED',
          refusalReason: refusal,
          durationMs: Date.now() - started,
        },
      });
      throw new ForbiddenException({
        requestId,
        status: 'REFUSED',
        refusal,
        skillsApplied: loaded.names,
      });
    }

    const spec = this.stubSpec(dto.prompt);
    const inputTokens = Math.ceil((loaded.block.length + dto.prompt.length) / 4);
    const outputTokens = Math.ceil(JSON.stringify(spec).length / 4);

    await this.prisma.$transaction([
      this.prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'SUCCEEDED',
          resultSpec: spec as Prisma.InputJsonValue,
          inputTokens,
          outputTokens,
          durationMs: Date.now() - started,
        },
      }),
      this.prisma.usageRecord.create({
        data: {
          userId,
          generationId: generation.id,
          inputTokens,
          outputTokens,
          estimatedCostUsd: 0,
        },
      }),
      ...(dto.appId
        ? [
            this.prisma.app.update({
              where: { id: dto.appId },
              data: { status: 'DRAFT' },
            }),
          ]
        : []),
    ]);

    if (dto.appId) {
      const draft = dto.draftId
        ? await this.prisma.draft.findFirst({
            where: { id: dto.draftId, appId: dto.appId },
          })
        : await this.prisma.draft.findFirst({
            where: { appId: dto.appId },
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
      requestId,
      status: 'SUCCEEDED',
      skillsApplied: loaded.names,
      spec,
      provider: 'stub',
    };
  }

  private detectHardRefusal(prompt: string, skillsBlock: string): string | null {
    const lower = prompt.toLowerCase();
    const banned = ['keylogger', 'ransomware', 'phishing kit', 'csam'];
    for (const term of banned) {
      if (lower.includes(term)) {
        return `refused by gateway policy (${term})`;
      }
    }
    if (!skillsBlock.trim()) {
      return null;
    }
    return null;
  }

  private stubSpec(prompt: string) {
    return {
      app: { name: 'Generated app', runtime: { min_version: '1.0.0' } },
      capabilities: this.guessCapabilities(prompt),
      pages: [{ name: 'Home', type: 'custom' }],
      entities: {},
      notes: 'Stub provider. Replace with AI Gateway adapters. Skills were injected.',
      sourcePrompt: prompt.slice(0, 500),
    };
  }

  private guessCapabilities(prompt: string): string[] {
    const lower = prompt.toLowerCase();
    const caps: string[] = ['storage', 'database'];
    if (lower.includes('camera') || lower.includes('photo') || lower.includes('barcode')) {
      caps.push('camera');
    }
    if (lower.includes('bluetooth')) {
      caps.push('bluetooth');
    }
    if (lower.includes('fichier') || lower.includes('file') || lower.includes('pdf')) {
      caps.push('files');
    }
    return caps;
  }
}
