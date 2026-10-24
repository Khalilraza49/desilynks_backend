import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService, RedisService, MailService } from '@libs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterSeedDto } from './dto/register-seed.dto';
import { Admin } from '@generated/prisma';

const SALT_ROUNDS = 12;
const MAX_OTP_ATTEMPTS = 5;
const OTP_TTL = 15 * 60;

export interface Payload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async seedAdmin(dto: RegisterSeedDto, seedKey?: string) {
    const configuredSeedSecret =
      this.configService.get<string>('ADMIN_SEED_SECRET');

    if (!configuredSeedSecret || seedKey !== configuredSeedSecret) {
      throw new UnauthorizedException('Invalid or missing seed key');
    }

    const adminCount = await this.prisma.admin.count();

    if (adminCount > 0) {
      throw new ForbiddenException(
        'Admin already exists in the system. Seed endpoint disabled.',
      );
    }

    const { email, phoneNumber, password, firstName, lastName } = dto;

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const newAdmin = await this.prisma.admin.create({
      data: {
        firstName,
        lastName,
        email,
        phoneNumber,
        password: hashedPassword,
      },
    });

    const { password: _password, ...safeAdmin } = newAdmin;

    return {
      message: 'Admin seed successful',
      admin: safeAdmin,
    };
  }

  private async generateLoginResponse(admin: Admin) {
    const payload: Payload = {
      sub: admin.id,
      email: admin.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const { password: _password, ...safeAdmin } = admin;

    return {
      message: 'Admin logged in successfully',
      accessToken,
      admin: safeAdmin,
    };
  }

  async login(dto: LoginDto) {
    const { email, password } = dto;

    const admin = await this.prisma.admin.findFirst({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordCorrect = await bcrypt.compare(password, admin.password);
    if (!isPasswordCorrect) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateLoginResponse(admin);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;

    const admin = await this.prisma.admin.findFirst({
      where: {
        email,
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const redisKey = `admin-reset-password:${email}`;
    const existingOtp = await this.redis.get(redisKey);

    if (existingOtp) {
      throw new BadRequestException('OTP already sent');
    }

    const otp = randomInt(100000, 1000000).toString();
    const fullName = `${admin.firstName} ${admin.lastName}`;

    const { success } = await this.mailService.sendPasswordResetEmail(
      email,
      fullName,
      otp,
    );

    if (!success) {
      throw new InternalServerErrorException(
        'Something went wrong while sending reset email',
      );
    }

    await this.redis.set(redisKey, otp, OTP_TTL);

    return {
      message: 'Check your mailbox for OTP',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { email, otp, newPassword } = dto;

    const admin = await this.prisma.admin.findFirst({
      where: {
        email,
      },
    });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const redisKey = `admin-reset-password:${email}`;
    const attemptsKey = `admin-otp-attempts:reset:${email}`;
    const cachedOtp: any = await this.redis.get(redisKey);

    if (!cachedOtp) {
      throw new BadRequestException('OTP is expired or invalid');
    }

    if (otp !== cachedOtp) {
      const attempts = await this.redis.incr(attemptsKey);

      if (attempts === 1) {
        await this.redis.expire(attemptsKey, OTP_TTL);
      }

      if (attempts >= MAX_OTP_ATTEMPTS) {
        await this.redis.del(redisKey);
        await this.redis.del(attemptsKey);

        throw new BadRequestException(
          'Too many failed attempts. OTP has been invalidated. Please request a new password reset.',
        );
      }

      throw new BadRequestException(
        `Incorrect OTP. ${MAX_OTP_ATTEMPTS - attempts} attempt(s) remaining.`,
      );
    }

    await this.redis.del(redisKey);
    await this.redis.del(attemptsKey);

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await this.prisma.admin.update({
      where: {
        id: admin.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    return {
      message:
        'Password reset successfully, you can now login using the new password',
    };
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const admin = await this.prisma.admin.findUnique({
      where: {
        id,
      },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const { currentPassword, newPassword } = dto;

    const isPasswordCorrect = await bcrypt.compare(
      currentPassword,
      admin.password,
    );
    if (!isPasswordCorrect) {
      throw new UnauthorizedException('Incorrect password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await this.prisma.admin.update({
      where: {
        id,
      },
      data: {
        password: hashedPassword,
      },
    });

    return {
      message: 'Password changed successfully',
    };
  }

  async logout(accessToken: string) {
    try {
      const decoded = this.jwtService.decode(accessToken);

      if (decoded?.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);

        if (ttl > 0) {
          await this.redis.set(`blacklist:${accessToken}`, 'revoked', ttl);
        }
      }

      return {
        message: 'Logged out successfully',
      };
    } catch (err) {
      this.logger.error('Logout failed', err);
      throw new InternalServerErrorException(
        'Something went wrong during logout',
      );
    }
  }
}
