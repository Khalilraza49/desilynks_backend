import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RegisterUserDto } from './dto/register-user.dto';
import {
  PrismaService,
  RedisService,
  SessionService,
  moveFileToProfilePhotos,
  deleteTempFile,
  deleteProfilePhoto,
  MailService,
} from '@libs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpPurpose, ResendOtpDto } from './dto/resend-otp.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto, AppleLoginDto } from './dto/social-login.dto';
import { JwtService } from '@nestjs/jwt';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Prisma, UserStatus } from '@generated/prisma';
import { OAuth2Client } from 'google-auth-library';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

const SALT_ROUNDS = 12;
const MAX_OTP_ATTEMPTS = 5;
const OTP_TTL = 15 * 60;
const OTP_RESEND_COOLDOWN = 60;
const MAX_OTP_RESENDS = 5;

type OtpKeys = {
  pending: string;
  attempts: string;
  cooldown: string;
  resends: string;
};

type PendingRegistration = {
  otp: string;
  userDetails: { firstName: string; lastName: string };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly googleClient: OAuth2Client;
  private readonly appleJwksClient: JwksClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    );
    this.appleJwksClient = new JwksClient({
      jwksUri: 'https://appleid.apple.com/auth/keys',
      cache: true,
      cacheMaxAge: 86400000,
    });
  }

  async register(dto: RegisterUserDto, file?: Express.Multer.File) {
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      gender,
      dateOfBirth,
      streetAddress,
      postalCode,
      city,
      province,
      country,
      password,
    } = dto;

    const isUserExist = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { phoneNumber }],
      },
    });

    if (isUserExist) {
      if (file) deleteTempFile(file.filename);

      if (
        isUserExist.email === email &&
        isUserExist.phoneNumber === phoneNumber
      ) {
        throw new ConflictException('Email and phone number already exist');
      } else if (isUserExist.email === email) {
        throw new ConflictException('Email already exists');
      } else if (isUserExist.phoneNumber === phoneNumber) {
        throw new ConflictException('Phone number already exists');
      }
    }

    const otpKeys = this.otpKeys(OtpPurpose.REGISTER, email);
    const existingOtp = await this.redis.get(otpKeys.pending);

    if (existingOtp) {
      if (file) deleteTempFile(file.filename);
      throw new BadRequestException('OTP already sent');
    }

    try {
      const otp = randomInt(100000, 1000000).toString();
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      const fullName = `${firstName} ${lastName}`;
      const { success } = await this.mailService.sendOtpEmail(
        email,
        fullName,
        otp,
      );

      if (!success) {
        throw new InternalServerErrorException(
          'Something went wrong while registration',
        );
      }

      const profilePhotoData = file
        ? {
            filename: file.filename,
            mimetype: file.mimetype,
          }
        : null;

      const payload = {
        otp,
        profilePhoto: profilePhotoData,
        userDetails: {
          firstName,
          lastName,
          gender,
          dateOfBirth,
          email,
          phoneNumber,
          password: hashedPassword,
          termsAcceptedAt: new Date(),
        },
        addressDetails: {
          streetAddress: streetAddress ?? null,
          postalCode: postalCode ?? null,
          city,
          province,
          country,
        },
      };

      await this.redis.set(otpKeys.pending, JSON.stringify(payload), OTP_TTL);
      await this.redis.set(otpKeys.cooldown, '1', OTP_RESEND_COOLDOWN);
      await this.redis.del(otpKeys.resends);

      return {
        message: 'Check your mailbox for further process',
      };
    } catch (err) {
      if (file) deleteTempFile(file.filename);
      throw err;
    }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const { otp, email } = dto;

    const otpKeys = this.otpKeys(OtpPurpose.REGISTER, email);

    const cachedPayload = await this.redis.get(otpKeys.pending);
    if (!cachedPayload) {
      throw new BadRequestException('OTP is expired or invalid');
    }

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(cachedPayload);
    } catch {
      throw new InternalServerErrorException(
        'Something went wrong verifying the OTP',
      );
    }

    if (parsedPayload.otp !== otp) {
      const attempts = await this.redis.incr(otpKeys.attempts);

      if (attempts === 1) {
        await this.redis.expire(otpKeys.attempts, OTP_TTL);
      }

      if (attempts >= MAX_OTP_ATTEMPTS) {
        await this.clearOtpState(otpKeys);

        if (parsedPayload.profilePhoto) {
          deleteTempFile(parsedPayload.profilePhoto.filename);
        }

        throw new BadRequestException(
          'Too many failed attempts. OTP has been invalidated. Please register again.',
        );
      }

      throw new BadRequestException(
        `Incorrect OTP. ${MAX_OTP_ATTEMPTS - attempts} attempt(s) remaining.`,
      );
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            ...parsedPayload.userDetails,
          },
        });

        let profilePhoto: any = null;
        if (parsedPayload.profilePhoto) {
          const profilePhotoUrl = moveFileToProfilePhotos(
            parsedPayload.profilePhoto.filename,
          );
          profilePhoto = await tx.profilePhoto.create({
            data: {
              url: profilePhotoUrl,
              filename: parsedPayload.profilePhoto.filename,
              mimetype: parsedPayload.profilePhoto.mimetype,
              userId: newUser.id,
            },
          });
        }

        const userAddress = await tx.userAddress.create({
          data: {
            streetAddress: parsedPayload.addressDetails.streetAddress,
            postalCode: parsedPayload.addressDetails.postalCode,
            city: parsedPayload.addressDetails.city,
            province: parsedPayload.addressDetails.province,
            country: parsedPayload.addressDetails.country,
            userId: newUser.id,
          },
        });

        return { newUser, profilePhoto, userAddress };
      });

      const { password: _password, ...safeUser } = result.newUser;
      const safeAddress = {
        streetAddress: result.userAddress.streetAddress,
        postalCode: result.userAddress.postalCode,
        city: result.userAddress.city,
        province: result.userAddress.province,
        country: result.userAddress.country,
      };

      await this.clearOtpState(otpKeys);

      return {
        message: 'User registered successfully',
        user: {
          ...safeUser,
          profilePhoto: {
            url: result.profilePhoto?.url ?? null,
          },
          userAddress: safeAddress,
        },
      };
    } catch (err) {
      if (parsedPayload.profilePhoto) {
        deleteProfilePhoto(parsedPayload.profilePhoto.filename);
        deleteTempFile(parsedPayload.profilePhoto.filename);
      }

      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email or phone number is already registered',
        );
      }
      throw err;
    }
  }

  async resendOtp(dto: ResendOtpDto) {
    const { email, purpose } = dto;
    const otpKeys = this.otpKeys(purpose, email);
    const noPendingMessage =
      purpose === OtpPurpose.REGISTER
        ? 'No pending registration found. Please register again'
        : 'No pending password reset found. Please request a new one';

    const cachedValue = await this.redis.get(otpKeys.pending);
    if (!cachedValue) {
      throw new BadRequestException(noPendingMessage);
    }

    let registerPayload: PendingRegistration | null = null;
    let fullName: string;

    if (purpose === OtpPurpose.REGISTER) {
      try {
        registerPayload = JSON.parse(cachedValue) as PendingRegistration;
      } catch {
        throw new InternalServerErrorException(
          'Something went wrong resending the OTP',
        );
      }
      fullName = `${registerPayload.userDetails.firstName} ${registerPayload.userDetails.lastName}`;
    } else {
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }
      fullName = `${user.firstName} ${user.lastName}`;
    }

    const resends = Number((await this.redis.get(otpKeys.resends)) ?? 0);
    if (resends >= MAX_OTP_RESENDS) {
      throw new HttpException(
        'Maximum resend attempts reached. Use the last OTP sent, or start again after it expires',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const cooldownAcquired = await this.redis.setIfNotExists(
      otpKeys.cooldown,
      '1',
      OTP_RESEND_COOLDOWN,
    );

    if (!cooldownAcquired) {
      const remainingMs = await this.redis.pttl(otpKeys.cooldown);
      const retryAfter = Math.max(1, Math.ceil(remainingMs / 1000));

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Please wait ${retryAfter} seconds before requesting a new OTP`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = randomInt(100000, 1000000).toString();

    const { success } =
      purpose === OtpPurpose.REGISTER
        ? await this.mailService.sendOtpEmail(email, fullName, otp)
        : await this.mailService.sendPasswordResetEmail(email, fullName, otp);

    if (!success) {
      await this.redis.del(otpKeys.cooldown);
      throw new InternalServerErrorException(
        'Something went wrong while sending the OTP',
      );
    }

    const replaced = await this.redis.setIfExists(
      otpKeys.pending,
      registerPayload ? JSON.stringify({ ...registerPayload, otp }) : otp,
      OTP_TTL,
    );

    if (!replaced) {
      throw new BadRequestException(noPendingMessage);
    }

    await this.redis.del(otpKeys.attempts);
    const sentResends = await this.redis.incr(otpKeys.resends);
    await this.redis.expire(otpKeys.resends, OTP_TTL);

    return {
      message: 'A new OTP has been sent',
      resendsRemaining: Math.max(0, MAX_OTP_RESENDS - sentResends),
    };
  }

  private otpKeys(purpose: OtpPurpose, email: string): OtpKeys {
    const isRegister = purpose === OtpPurpose.REGISTER;

    return {
      pending: isRegister ? `register:${email}` : `reset-password:${email}`,
      attempts: isRegister
        ? `otp-attempts:${email}`
        : `otp-attempts:reset:${email}`,
      cooldown: `otp-resend-cooldown:${purpose}:${email}`,
      resends: `otp-resends:${purpose}:${email}`,
    };
  }

  private async clearOtpState(otpKeys: OtpKeys) {
    await Promise.all(Object.values(otpKeys).map((key) => this.redis.del(key)));
  }

  private async generateTokens(user: { id: string; email: string }) {
    const payload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.sessionService.issueRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  private async generateLoginResponse(user: any) {
    this.assertCanSignIn(user);

    const { accessToken, refreshToken } = await this.generateTokens(user);
    const { password: _password, ...safeUser } = user;

    return {
      message: 'User logged in successfully',
      accessToken,
      refreshToken,
      user: safeUser,
    };
  }

  private assertCanSignIn(user: {
    status: UserStatus;
    deletedAt: Date | null;
  }) {
    if (user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account has been suspended');
    }
  }

  private async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        profilePhoto: { select: { url: true } },
        address: {
          select: {
            streetAddress: true,
            postalCode: true,
            country: true,
            city: true,
            province: true,
          },
        },
      },
    });
  }

  private async findUserByPhoneNumber(phoneNumber: string) {
    return this.prisma.user.findUnique({
      where: { phoneNumber },
      include: {
        profilePhoto: { select: { url: true } },
        address: {
          select: {
            streetAddress: true,
            postalCode: true,
            country: true,
            city: true,
            province: true,
          },
        },
      },
    });
  }

  async login(dto: LoginDto) {
    const { emailOrPhoneNumber, password } = dto;

    const isEmail = emailOrPhoneNumber.includes('@');

    const user = isEmail
      ? await this.findUserByEmail(emailOrPhoneNumber)
      : await this.findUserByPhoneNumber(emailOrPhoneNumber);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateLoginResponse(user);
  }

  async googleLogin(dto: GoogleLoginDto) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new BadRequestException('Invalid Google token: email not found');
      }

      if (payload.email_verified !== true) {
        throw new BadRequestException(
          'Invalid Google token: email is not verified',
        );
      }

      const user = await this.findUserByEmail(payload.email.toLowerCase());
      if (!user) {
        throw new NotFoundException(
          'No account found with this email. Please register first.',
        );
      }

      return await this.generateLoginResponse(user);
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      this.logger.error('Google token verification failed', err);
      throw new UnauthorizedException('Invalid or expired Google token');
    }
  }

  async appleLogin(dto: AppleLoginDto) {
    try {
      const decodedHeader = jwt.decode(dto.idToken, { complete: true });
      if (!decodedHeader || !decodedHeader.header.kid) {
        throw new BadRequestException('Invalid Apple token');
      }

      const key = await this.appleJwksClient.getSigningKey(
        decodedHeader.header.kid,
      );
      const publicKey = key.getPublicKey();

      const payload = jwt.verify(dto.idToken, publicKey, {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
        audience: this.configService.getOrThrow<string>('APPLE_BUNDLE_ID'),
      }) as jwt.JwtPayload;

      const email = payload.email as string | undefined;
      if (!email) {
        throw new BadRequestException(
          'Apple token does not contain an email. Please share your email during Apple Sign-In.',
        );
      }

      if (email.endsWith('@privaterelay.appleid.com')) {
        throw new BadRequestException(
          'Please share your real email address during Apple Sign-In instead of using the private relay.',
        );
      }

      const user = await this.findUserByEmail(email.toLowerCase());
      if (!user) {
        throw new NotFoundException(
          'No account found with this email. Please register first.',
        );
      }

      return await this.generateLoginResponse(user);
    } catch (err) {
      if (
        err instanceof NotFoundException ||
        err instanceof BadRequestException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      this.logger.error('Apple token verification failed', err);
      throw new UnauthorizedException('Invalid or expired Apple token');
    }
  }

  async refresh(dto: RefreshTokenDto) {
    const userId = await this.sessionService.consumeRefreshToken(
      dto.refreshToken,
    );

    if (!userId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true, deletedAt: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    this.assertCanSignIn(user);

    const { accessToken, refreshToken } = await this.generateTokens(user);

    return {
      message: 'Token refreshed successfully',
      accessToken,
      refreshToken,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const otpKeys = this.otpKeys(OtpPurpose.RESET_PASSWORD, email);
    const existingOtp = await this.redis.get(otpKeys.pending);

    if (existingOtp) {
      throw new BadRequestException('OTP already sent');
    }

    const otp = randomInt(100000, 1000000).toString();
    const fullName = `${user.firstName} ${user.lastName}`;

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

    await this.redis.set(otpKeys.pending, otp, OTP_TTL);
    await this.redis.set(otpKeys.cooldown, '1', OTP_RESEND_COOLDOWN);
    await this.redis.del(otpKeys.resends);

    return {
      message: 'Check your mailbox for OTP',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { email, otp, newPassword } = dto;

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const otpKeys = this.otpKeys(OtpPurpose.RESET_PASSWORD, email);
    const cachedOtp: any = await this.redis.get(otpKeys.pending);

    if (!cachedOtp) {
      throw new BadRequestException('OTP is expired or invalid');
    }

    if (otp !== cachedOtp) {
      const attempts = await this.redis.incr(otpKeys.attempts);

      if (attempts === 1) {
        await this.redis.expire(otpKeys.attempts, OTP_TTL);
      }

      if (attempts >= MAX_OTP_ATTEMPTS) {
        await this.clearOtpState(otpKeys);

        throw new BadRequestException(
          'Too many failed attempts. OTP has been invalidated. Please request a new password reset.',
        );
      }

      throw new BadRequestException(
        `Incorrect OTP. ${MAX_OTP_ATTEMPTS - attempts} attempt(s) remaining.`,
      );
    }

    await this.clearOtpState(otpKeys);

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await this.prisma.user.update({
      where: {
        email,
      },
      data: {
        password: hashedPassword,
      },
    });

    await this.sessionService.revokeAllRefreshTokens(user.id);

    return {
      message:
        'Password reset successfully now you can login using new password',
    };
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { currentPassword, newPassword } = dto;

    const isPasswordCorrect = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordCorrect) {
      throw new UnauthorizedException('Incorrect password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await this.prisma.user.update({
      where: {
        id,
      },
      data: {
        password: hashedPassword,
      },
    });

    await this.sessionService.revokeAllRefreshTokens(id);

    const { accessToken, refreshToken } = await this.generateTokens(user);

    return {
      message: 'Password changed successfully',
      accessToken,
      refreshToken,
    };
  }

  async logout(accessToken: string, refreshToken?: string) {
    try {
      const decoded = this.jwtService.decode(accessToken);

      if (decoded?.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);

        if (ttl > 0) {
          await this.redis.set(`blacklist:${accessToken}`, 'revoked', ttl);
        }
      }

      if (refreshToken) {
        await this.sessionService.consumeRefreshToken(refreshToken);
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
