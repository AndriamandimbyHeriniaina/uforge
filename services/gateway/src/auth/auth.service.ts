import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Creates a Uforge account with a default FREE quota.
   *
   * @example
   * const session = await authService.register({
   *   email: 'owner@example.com',
   *   password: 'correct-horse',
   * });
   */
  async register(dto: RegisterDto): Promise<{ token: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const bootstrapAdmin = this.config
      .get<string>('BOOTSTRAP_ADMIN_EMAIL', '')
      .toLowerCase();
    const email = dto.email.toLowerCase();
    const role =
      bootstrapAdmin && email === bootstrapAdmin ? UserRole.ADMIN : UserRole.USER;
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        quota: { create: {} },
      },
    });
    return { token: this.sign(user.id, user.email, user.role) };
  }

  async login(dto: LoginDto): Promise<{ token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('invalid credentials');
    }
    return { token: this.sign(user.id, user.email, user.role) };
  }

  async me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        plan: true,
        createdAt: true,
        quota: true,
      },
    });
  }

  private sign(sub: string, email: string, role: 'USER' | 'ADMIN'): string {
    return this.jwt.sign({ sub, email, role });
  }
}
