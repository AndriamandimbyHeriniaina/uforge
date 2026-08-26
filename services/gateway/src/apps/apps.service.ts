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
      include: { drafts: true, versions: true },
    });
  }

  /**
   * Returns the unique app of this Runtime (create on first use).
   * Uforge is not an app manager: one .happ per install.
   *
   * @example
   * const app = await appsService.ensureCurrent(userId);
   */
  async ensureCurrent(ownerId: string) {
    const existing = await this.prisma.app.findFirst({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
      include: { drafts: { orderBy: { revision: 'desc' } }, versions: true },
    });
    if (existing) {
      return existing;
    }
    return this.create(ownerId, { name: 'Mon application' });
  }

  /**
   * Records that the Runtime compiled on device. The .happ is never uploaded.
   *
   * @example
   * await appsService.markCompiledOnDevice(userId);
   */
  async markCompiledOnDevice(ownerId: string) {
    const app = await this.ensureCurrent(ownerId);
    const last = await this.prisma.appVersion.findFirst({
      where: { appId: app.id },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (last?.versionNumber ?? 0) + 1;
    await this.prisma.appVersion.create({
      data: {
        appId: app.id,
        versionNumber,
        manifestJson: { stored: 'device' },
      },
    });
    return this.prisma.app.update({
      where: { id: app.id },
      data: { status: 'PUBLISHED' },
      include: { drafts: { orderBy: { revision: 'desc' }, take: 1 } },
    });
  }

  /**
   * Empties the Builder draft. Does not delete the Uforge account.
   *
   * @example
   * await appsService.resetCurrent(userId);
   */
  async resetCurrent(ownerId: string) {
    const app = await this.ensureCurrent(ownerId);
    await this.prisma.draft.updateMany({
      where: { appId: app.id },
      data: { specJson: {} },
    });
    return this.prisma.app.update({
      where: { id: app.id },
      data: { status: 'EMPTY', name: 'Mon application' },
      include: { drafts: { orderBy: { revision: 'desc' }, take: 1 } },
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
