import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppDto } from './apps.dto';

@Injectable()
export class AppsService {
  constructor(private readonly prisma: PrismaService) {}

  list(ownerId: string) {
    return this.prisma.app.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      include: { drafts: { orderBy: { revision: 'desc' }, take: 1 } },
    });
  }

  /**
   * Creates an empty app and revision 1 draft (spec `{}`).
   *
   * @example
   * const app = await appsService.create(userId, { name: 'Stock' });
   */
  async create(ownerId: string, dto: CreateAppDto) {
    const slug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'app';
    const publicId = `happ_${randomUUID().slice(0, 8)}`;
    return this.prisma.app.create({
      data: {
        ownerId,
        name: dto.name,
        slug: `${slug}-${publicId.slice(-4)}`,
        publicId,
        drafts: {
          create: { revision: 1, specJson: {} },
        },
      },
      include: { drafts: true },
    });
  }

  async getOwned(ownerId: string, appId: string) {
    const app = await this.prisma.app.findFirst({
      where: { id: appId, ownerId },
      include: { drafts: { orderBy: { revision: 'desc' } }, versions: true },
    });
    if (!app) {
      throw new NotFoundException('app not found');
    }
    return app;
  }
}
