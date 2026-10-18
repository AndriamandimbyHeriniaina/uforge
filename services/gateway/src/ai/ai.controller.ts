import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { GenerateDto } from './generate.dto';
import { AiService } from './ai.service';

@Controller('v1/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  /**
   * One conversation turn over SSE: `meta`, then `token` / `op` while the model
   * writes, then `done` with the final file contents. Auth, quota and size
   * errors are thrown before the stream opens, as plain JSON.
   *
   * @example
   * POST /v1/ai/generate { message, files, assets, attachments, errors, conversation }
   */
  @Post('generate')
  async generate(
    @Req() req: Request & { user: AuthUser },
    @Res() res: Response,
    @Body() dto: GenerateDto,
  ): Promise<void> {
    const ctx = await this.ai.beginTurn(req.user.sub, dto);
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) {
        abort.abort();
      }
    });
    // Long thinking phases send nothing: keep proxies from closing the stream.
    const keepAlive = setInterval(() => res.write(': ping\n\n'), 15_000);

    writeSse(res, 'meta', { requestId: ctx.requestId, skills: ctx.skillsApplied });
    try {
      const done = await this.ai.runTurn(
        ctx,
        {
          token: (text) => writeSse(res, 'token', { text }),
          op: (event) => writeSse(res, 'op', event),
        },
        abort.signal,
      );
      writeSse(res, 'done', done);
    } catch (err) {
      writeSse(res, 'error', { message: err instanceof Error ? err.message : 'turn failed' });
    } finally {
      clearInterval(keepAlive);
      res.end();
    }
  }
}

function writeSse(res: Response, event: string, data: unknown): void {
  if (res.writableEnded) {
    return;
  }
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const flushable = res as Response & { flush?: () => void };
  flushable.flush?.();
}
