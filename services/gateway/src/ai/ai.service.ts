import {
  BadGatewayException,
  ForbiddenException,
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
import type { AppSpec } from './providers/provider.types';

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
   * Runs one Builder generation: reload skills, enforce quota, call the LLM adapter.
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

    const refusal = this.detectHardRefusal(dto.prompt);
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

    let result;
    try {
      result = await this.providers.generate({
        skillsBlock: loaded.block,
        prompt: dto.prompt,
        currentSpec,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'provider error';
      await this.prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          refusalReason: message,
          durationMs: Date.now() - started,
        },
      });
      throw new BadGatewayException({
        requestId,
        status: 'FAILED',
        message,
        skillsApplied: loaded.names,
      });
    }

    if (result.refusal) {
      await this.prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'REFUSED',
          refusalReason: result.refusal,
          provider: result.provider,
          model: result.model,
          durationMs: Date.now() - started,
        },
      });
      throw new ForbiddenException({
        requestId,
        status: 'REFUSED',
        refusal: result.refusal,
        skillsApplied: loaded.names,
      });
    }

    const spec = result.spec;
    await this.prisma.$transaction([
      this.prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: 'SUCCEEDED',
          resultSpec: spec as Prisma.InputJsonValue,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          provider: result.provider,
          model: result.model,
          durationMs: Date.now() - started,
        },
      }),
      this.prisma.usageRecord.create({
        data: {
          userId,
          generationId: generation.id,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          estimatedCostUsd: 0,
        },
      }),
      ...(dto.appId
        ? [
            this.prisma.app.update({
              where: { id: dto.appId },
              data: {
                status: 'DRAFT',
                ...(spec.app?.name ? { name: spec.app.name } : {}),
              },
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
