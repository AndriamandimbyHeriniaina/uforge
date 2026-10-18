import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SkillsModule } from '../skills/skills.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AnthropicAdapter } from './providers/anthropic.adapter';
import { OpenAiAdapter } from './providers/openai.adapter';
import { ProviderRouter } from './providers/provider.router';
import { StubAdapter } from './providers/stub.adapter';

@Module({
  imports: [AuthModule, SkillsModule],
  controllers: [AiController],
  providers: [AiService, ProviderRouter, AnthropicAdapter, OpenAiAdapter, StubAdapter],
})
export class AiModule {}
