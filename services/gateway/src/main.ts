import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = Number(process.env.GATEWAY_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();

/**
 * Browser PWA plus Capacitor WebView origins.
 *
 * @example
 * corsOrigins(); // ['http://localhost:5173', 'https://localhost', ...]
 */
function corsOrigins(): string[] {
  const extra = (process.env.WEB_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return [
    ...new Set([
      ...extra,
      'http://localhost:5173',
      'https://localhost',
      'capacitor://localhost',
      'http://localhost',
    ]),
  ];
}
