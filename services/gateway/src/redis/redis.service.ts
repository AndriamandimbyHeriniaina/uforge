import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>('REDIS_URL', 'redis://redis:6379'));
  }

  /**
   * Increments a sliding daily counter and returns the new value.
   *
   * @example
   * const used = await redis.incrDaily('gen', userId);
   * if (used > quota.dailyGenerations) throw new HttpException('quota', 429);
   */
  async incrDaily(kind: string, userId: string): Promise<number> {
    const day = new Date().toISOString().slice(0, 10);
    const key = `hforge:quota:${kind}:${userId}:${day}`;
    const value = await this.client.incr(key);
    if (value === 1) {
      await this.client.expire(key, 60 * 60 * 48);
    }
    return value;
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
