import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { GenerateDto } from '../apps/apps.dto';
import { AiService } from './ai.service';

@Controller('v1/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  /**
   * Streams the assistant reply (SSE), then a final `done` event with the spec.
   *
   * @example
   * POST /v1/ai/generate  →  event: token / event: done
   */
  @Post('generate')
  async generate(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Body() dto: GenerateDto,
  ): Promise<void> {
    const ctx = await this.ai.beginGenerate(req.user.sub, dto);
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const abort = new AbortController();
    req.on('close', () => abort.abort());

    writeSse(res, 'meta', {
      requestId: ctx.requestId,
      skillsApplied: ctx.skillsApplied,
    });

    try {
      const result = await this.ai.streamGenerate(
        ctx,
        (text) => writeSse(res, 'token', { text }),
        abort.signal,
      );
      writeSse(res, 'done', result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'provider error';
      writeSse(res, 'error', { message });
    }
    res.end();
  }
}

function writeSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const flushable = res as Response & { flush?: () => void };
  flushable.flush?.();
}
