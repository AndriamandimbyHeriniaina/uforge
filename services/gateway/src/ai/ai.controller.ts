import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { GenerateDto } from '../apps/apps.dto';
import { AiService } from './ai.service';

@Controller('v1/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('generate')
  generate(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: GenerateDto,
  ) {
    return this.ai.generate(req.user.sub, dto);
  }
}
