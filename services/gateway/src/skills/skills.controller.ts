import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { SkillsService } from './skills.service';

@Controller('v1/skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  /**
   * Lists deposited prompt skills. Restricted to ADMIN so operators can
   * verify what will be injected without exposing the files to every user.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: Request & { user: AuthUser }) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException();
    }
    const items = await this.skills.list();
    return items.map((skill) => ({
      filename: skill.filename,
      name: skill.name,
      priority: skill.priority,
      enabled: skill.enabled,
    }));
  }
}
