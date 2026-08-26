import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { AppsModule } from './apps/apps.module';
import { AiModule } from './ai/ai.module';
import { SkillsModule } from './skills/skills.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    StorageModule,
    AuthModule,
    AppsModule,
    SkillsModule,
    AiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
