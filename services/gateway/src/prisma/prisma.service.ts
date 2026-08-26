import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  /**
   * Opens the Postgres connection when the Nest process starts.
   *
   * @example
   * // Injected automatically; no manual call needed in controllers.
   * constructor(private readonly prisma: PrismaService) {}
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
