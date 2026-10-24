import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  MailService,
  PrismaService,
  RedisService,
  SessionService,
} from '@libs/common';
import { Gender, UserStatus } from '@generated/prisma';
import { AuthService } from './auth.service';
import { OtpPurpose } from './dto/resend-otp.dto';

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    userAddress: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let redis: Record<string, jest.Mock>;
  let mailService: {
    sendOtpEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; decode: jest.Mock };
  let sessionService: {
    issueRefreshToken: jest.Mock;
    consumeRefreshToken: jest.Mock;
    revokeAllRefreshTokens: jest.Mock;
  };
  let passwordHash: string;

  const activeUser = () => ({
    id: 'user-1',
    email: 'user@example.com',
    password: passwordHash,
    status: UserStatus.ACTIVE,
    deletedAt: null,
  });

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('correct-password', 4);
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      userAddress: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
    redis = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(undefined),
      setIfNotExists: jest.fn().mockResolvedValue(true),
      setIfExists: jest.fn().mockResolvedValue(true),
      pttl: jest.fn().mockResolvedValue(-2),
    };
    mailService = {
      sendOtpEmail: jest.fn().mockResolvedValue({ success: true }),
      sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
      decode: jest.fn(),
    };
    sessionService = {
      issueRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
      consumeRefreshToken: jest.fn(),
      revokeAllRefreshTokens: jest.fn().mockResolvedValue(undefined),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: MailService, useValue: mailService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('client-id') },
        },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();

    authService = app.get<AuthService>(AuthService);
  });

  describe('registration address fields', () => {
    const requiredAddress = {
      city: 'Berlin',
      province: 'Berlin',
      country: 'Germany',
    };
    const registrationDto = {
      firstName: 'John',
      lastName: 'Doe',
      gender: Gender.MALE,
      dateOfBirth: new Date('1990-01-01'),
      email: 'user@example.com',
      phoneNumber: '+14155550100',
      password: 'password-123',
      acceptTerms: true,
      ...requiredAddress,
    };
    const cases = [
      {
        name: 'omitted fields',
        input: {},
        expected: { streetAddress: null, postalCode: null },
      },
      {
        name: 'explicit nulls',
        input: { streetAddress: null, postalCode: null },
        expected: { streetAddress: null, postalCode: null },
      },
      {
        name: 'populated fields',
        input: { streetAddress: 'Main Street 1', postalCode: '10115' },
        expected: { streetAddress: 'Main Street 1', postalCode: '10115' },
      },
      {
        name: 'only street address',
        input: { streetAddress: 'Main Street 1' },
        expected: { streetAddress: 'Main Street 1', postalCode: null },
      },
      {
        name: 'only postal code',
        input: { postalCode: '10115' },
        expected: { streetAddress: null, postalCode: '10115' },
      },
      {
        name: 'mixed null and string',
        input: { streetAddress: null, postalCode: '10115' },
        expected: { streetAddress: null, postalCode: '10115' },
      },
    ];

    it.each(cases)(
      'should cache $name as nullable address data',
      async ({ input, expected }) => {
        await authService.register(
          { ...registrationDto, ...input } as Parameters<
            AuthService['register']
          >[0],
        );

        const cachedCall = redis.set.mock.calls.find(
          ([key]: [string]) => key === 'register:user@example.com',
        ) as [string, string, number] | undefined;
        expect(cachedCall).toBeDefined();
        const payload = JSON.parse(cachedCall![1]) as {
          addressDetails: unknown;
        };
        expect(payload.addressDetails).toEqual({
          ...requiredAddress,
          ...expected,
        });
      },
    );

    it.each(cases)(
      'should complete OTP verification with $name',
      async ({ input, expected }) => {
        const user = { ...activeUser(), firstName: 'John', lastName: 'Doe' };
        redis.get.mockResolvedValue(
          JSON.stringify({
            otp: '123456',
            profilePhoto: null,
            userDetails: user,
            addressDetails: { ...requiredAddress, ...input },
          }),
        );
        prisma.user.create.mockResolvedValue(user);
        const address = { ...requiredAddress, ...expected };
        prisma.userAddress.create.mockResolvedValue({
          id: 'address-1',
          userId: user.id,
          ...address,
        });

        const result = await authService.verifyOtp({
          email: user.email,
          otp: '123456',
        });

        expect(prisma.userAddress.create).toHaveBeenCalledWith({
          data: { userId: user.id, ...address },
        });
        expect(result.user.userAddress).toEqual(address);
        expect(result.user).not.toHaveProperty('password');
      },
    );
  });

  describe('login', () => {
    it('should return nullable address fields', async () => {
      const address = {
        streetAddress: null,
        postalCode: null,
        city: 'Berlin',
        province: 'Berlin',
        country: 'Germany',
      };
      prisma.user.findUnique.mockResolvedValue({ ...activeUser(), address });

      const result = await authService.login({
        emailOrPhoneNumber: 'user@example.com',
        password: 'correct-password',
      });

      expect(result.user).toHaveProperty('address', address);
      expect(result.user).not.toHaveProperty('password');
    });

    it('should return an access token and a refresh token', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser());

      const result = await authService.login({
        emailOrPhoneNumber: 'user@example.com',
        password: 'correct-password',
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).not.toHaveProperty('password');
      expect(sessionService.issueRefreshToken).toHaveBeenCalledWith('user-1');
    });

    it('should reject a suspended account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...activeUser(),
        status: UserStatus.SUSPENDED,
      });

      await expect(
        authService.login({
          emailOrPhoneNumber: 'user@example.com',
          password: 'correct-password',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(sessionService.issueRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should rotate the refresh token', async () => {
      sessionService.consumeRefreshToken.mockResolvedValue('user-1');
      prisma.user.findUnique.mockResolvedValue(activeUser());

      const result = await authService.refresh({ refreshToken: 'old-token' });

      expect(sessionService.consumeRefreshToken).toHaveBeenCalledWith(
        'old-token',
      );
      expect(result).toEqual({
        message: 'Token refreshed successfully',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should reject an unknown or already used refresh token', async () => {
      sessionService.consumeRefreshToken.mockResolvedValue(null);

      await expect(
        authService.refresh({ refreshToken: 'used-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a deleted account', async () => {
      sessionService.consumeRefreshToken.mockResolvedValue('user-1');
      prisma.user.findUnique.mockResolvedValue({
        ...activeUser(),
        deletedAt: new Date(),
      });

      await expect(
        authService.refresh({ refreshToken: 'old-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a suspended account', async () => {
      sessionService.consumeRefreshToken.mockResolvedValue('user-1');
      prisma.user.findUnique.mockResolvedValue({
        ...activeUser(),
        status: UserStatus.SUSPENDED,
      });

      await expect(
        authService.refresh({ refreshToken: 'old-token' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('changePassword', () => {
    it('should revoke existing sessions and return new tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser());

      const result = await authService.changePassword('user-1', {
        currentPassword: 'correct-password',
        newPassword: 'new-password-123',
      });

      expect(sessionService.revokeAllRefreshTokens).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });
  });

  describe('logout', () => {
    it('should revoke the refresh token of the session', async () => {
      jwtService.decode.mockReturnValue({
        exp: Math.floor(Date.now() / 1000) + 600,
      });

      await authService.logout('access-token', 'refresh-token');

      expect(redis.set).toHaveBeenCalledWith(
        'blacklist:access-token',
        'revoked',
        expect.any(Number),
      );
      expect(sessionService.consumeRefreshToken).toHaveBeenCalledWith(
        'refresh-token',
      );
    });
  });

  describe('resendOtp', () => {
    const email = 'user@example.com';
    const pendingRegistration = {
      otp: '111111',
      profilePhoto: null,
      userDetails: { firstName: 'John', lastName: 'Doe', email },
      addressDetails: { city: 'Berlin' },
    };

    const mockRedisValues = (values: Record<string, string>) =>
      redis.get.mockImplementation((key: string) =>
        Promise.resolve(values[key] ?? null),
      );

    it('should reject when no OTP is pending', async () => {
      await expect(
        authService.resendOtp({ email, purpose: OtpPurpose.REGISTER }),
      ).rejects.toThrow(BadRequestException);
      expect(mailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('should send a new registration OTP and keep the stored details', async () => {
      mockRedisValues({
        [`register:${email}`]: JSON.stringify(pendingRegistration),
      });

      const result = await authService.resendOtp({
        email,
        purpose: OtpPurpose.REGISTER,
      });

      expect(result).toEqual({
        message: 'A new OTP has been sent',
        resendsRemaining: 4,
      });
      expect(redis.setIfNotExists).toHaveBeenCalledWith(
        `otp-resend-cooldown:register:${email}`,
        '1',
        60,
      );
      expect(mailService.sendOtpEmail).toHaveBeenCalledWith(
        email,
        'John Doe',
        expect.stringMatching(/^\d{6}$/),
      );
      const [, , newOtp] = mailService.sendOtpEmail.mock.calls[0] as string[];
      expect(redis.setIfExists).toHaveBeenCalledWith(
        `register:${email}`,
        JSON.stringify({ ...pendingRegistration, otp: newOtp }),
        15 * 60,
      );
      expect(redis.del).toHaveBeenCalledWith(`otp-attempts:${email}`);
      expect(redis.incr).toHaveBeenCalledWith(`otp-resends:register:${email}`);
      expect(redis.expire).toHaveBeenCalledWith(
        `otp-resends:register:${email}`,
        15 * 60,
      );
    });

    it('should send a new password reset OTP', async () => {
      mockRedisValues({ [`reset-password:${email}`]: '111111' });
      prisma.user.findUnique.mockResolvedValue({
        firstName: 'John',
        lastName: 'Doe',
      });
      redis.incr.mockResolvedValue(3);

      const result = await authService.resendOtp({
        email,
        purpose: OtpPurpose.RESET_PASSWORD,
      });

      expect(result.resendsRemaining).toBe(2);
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        email,
        'John Doe',
        expect.stringMatching(/^\d{6}$/),
      );
      const [, , newOtp] = mailService.sendPasswordResetEmail.mock
        .calls[0] as string[];
      expect(redis.setIfExists).toHaveBeenCalledWith(
        `reset-password:${email}`,
        newOtp,
        15 * 60,
      );
      expect(redis.del).toHaveBeenCalledWith(`otp-attempts:reset:${email}`);
    });

    it('should reject a resend during the cooldown', async () => {
      mockRedisValues({
        [`register:${email}`]: JSON.stringify(pendingRegistration),
      });
      redis.setIfNotExists.mockResolvedValue(false);
      redis.pttl.mockResolvedValue(41200);

      const error = await authService
        .resendOtp({ email, purpose: OtpPurpose.REGISTER })
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect((error as HttpException).getResponse()).toEqual(
        expect.objectContaining({ retryAfter: 42 }),
      );
      expect(mailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('should reject after the maximum number of resends', async () => {
      mockRedisValues({
        [`register:${email}`]: JSON.stringify(pendingRegistration),
        [`otp-resends:register:${email}`]: '5',
      });

      const error = await authService
        .resendOtp({ email, purpose: OtpPurpose.REGISTER })
        .catch((err: unknown) => err);

      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect(redis.setIfNotExists).not.toHaveBeenCalled();
      expect(mailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('should release the cooldown when the email fails', async () => {
      mockRedisValues({
        [`register:${email}`]: JSON.stringify(pendingRegistration),
      });
      mailService.sendOtpEmail.mockResolvedValue({ success: false });

      await expect(
        authService.resendOtp({ email, purpose: OtpPurpose.REGISTER }),
      ).rejects.toThrow(InternalServerErrorException);
      expect(redis.del).toHaveBeenCalledWith(
        `otp-resend-cooldown:register:${email}`,
      );
      expect(redis.setIfExists).not.toHaveBeenCalled();
    });

    it('should not restore an OTP that was verified in the meantime', async () => {
      mockRedisValues({
        [`register:${email}`]: JSON.stringify(pendingRegistration),
      });
      redis.setIfExists.mockResolvedValue(false);

      await expect(
        authService.resendOtp({ email, purpose: OtpPurpose.REGISTER }),
      ).rejects.toThrow(BadRequestException);
      expect(redis.incr).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('should start the resend cooldown after sending the OTP', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser());

      await authService.forgotPassword({ email: 'user@example.com' });

      expect(redis.set).toHaveBeenCalledWith(
        'otp-resend-cooldown:reset-password:user@example.com',
        '1',
        60,
      );
      expect(redis.del).toHaveBeenCalledWith(
        'otp-resends:reset-password:user@example.com',
      );
    });
  });

  describe('resetPassword', () => {
    it('should clear all OTP state after a successful reset', async () => {
      prisma.user.findUnique.mockResolvedValue(activeUser());
      redis.get.mockResolvedValue('123456');

      await authService.resetPassword({
        email: 'user@example.com',
        otp: '123456',
        newPassword: 'new-password-123',
      });

      for (const key of [
        'reset-password:user@example.com',
        'otp-attempts:reset:user@example.com',
        'otp-resend-cooldown:reset-password:user@example.com',
        'otp-resends:reset-password:user@example.com',
      ]) {
        expect(redis.del).toHaveBeenCalledWith(key);
      }
    });
  });
});
