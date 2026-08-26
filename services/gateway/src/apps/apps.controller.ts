import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { AppsService } from './apps.service';
import { CreateAppDto } from './apps.dto';

@Controller('v1/apps')
@UseGuards(JwtAuthGuard)
export class AppsController {
  constructor(private readonly apps: AppsService) {}

  @Get()
  list(@Req() req: Request & { user: AuthUser }) {
    return this.apps.list(req.user.sub);
  }

  @Get('current')
  current(@Req() req: Request & { user: AuthUser }) {
    return this.apps.ensureCurrent(req.user.sub);
  }

  @Post('current/compile')
  compile(@Req() req: Request & { user: AuthUser }) {
    return this.apps.markCompiledOnDevice(req.user.sub);
  }

  @Post()
  create(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: CreateAppDto,
  ) {
    return this.apps.create(req.user.sub, dto);
  }

  @Get(':id')
  get(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.apps.getOwned(req.user.sub, id);
  }
}
