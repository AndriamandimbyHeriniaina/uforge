import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: Client;
  readonly contextBucket: string;

  constructor(config: ConfigService) {
    this.client = new Client({
      endPoint: config.get<string>('MINIO_ENDPOINT', 'minio'),
      port: Number(config.get<string>('MINIO_PORT', '9000')),
      useSSL: config.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: config.get<string>('MINIO_ACCESS_KEY', 'hforge'),
      secretKey: config.get<string>('MINIO_SECRET_KEY', 'hforgesecret'),
    });
    this.contextBucket = config.get<string>('MINIO_BUCKET_CONTEXT', 'hforge-context');
  }

  async onModuleInit(): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        if (!(await this.client.bucketExists(this.contextBucket))) {
          await this.client.makeBucket(this.contextBucket);
        }
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  /**
   * Stores a Builder context file and returns the object key.
   *
   * @example
   * const key = await storage.putContext(userId, 'stock.xlsx', buffer);
   */
  async putContext(userId: string, filename: string, body: Buffer): Promise<string> {
    const key = `${userId}/${Date.now()}-${filename}`;
    await this.client.putObject(this.contextBucket, key, body);
    return key;
  }
}
