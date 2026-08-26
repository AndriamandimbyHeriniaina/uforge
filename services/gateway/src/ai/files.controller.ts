import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Controller('v1/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @Req() req: Request & { user: AuthUser },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const key = await this.storage.putContext(
      req.user.sub,
      file.originalname,
      file.buffer,
    );
    return this.prisma.uploadedFile.create({
      data: {
        userId: req.user.sub,
        storageKey: key,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        purpose: 'CONTEXT',
      },
    });
  }
}
