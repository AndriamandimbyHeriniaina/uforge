import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SkillsModule } from '../skills/skills.module';
import { AppsModule } from '../apps/apps.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { FilesController } from './files.controller';

@Module({
  imports: [AuthModule, SkillsModule, AppsModule],
  controllers: [AiController, FilesController],
  providers: [AiService],
})
export class AiModule {}
