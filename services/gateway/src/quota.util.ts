import { ConfigService } from '@nestjs/config';

/** Daily generation cap applied when the gateway is not in production. */
export const DEV_DAILY_GENERATIONS = 30;

/**
 * True when this process is a local / Compose gateway (`start:dev`).
 *
 * @example
 * if (isGatewayDev(config)) {
 *   // use the raised local quota
 * }
 */
export function isGatewayDev(config: ConfigService): boolean {
  return config.get<string>('NODE_ENV', 'development') !== 'production';
}

/**
 * Plan quota stored in Postgres, raised to 30 generations/day in dev.
 *
 * @example
 * const limit = effectiveDailyGenerations(user.quota.dailyGenerations, config);
 * if (used > limit) throw new HttpException('daily generation quota exceeded', 429);
 */
export function effectiveDailyGenerations(
  stored: number,
  config: ConfigService,
): number {
  if (isGatewayDev(config)) {
    return Math.max(stored, DEV_DAILY_GENERATIONS);
  }
  return stored;
}
