import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService, RedisService } from '@libs/common';
import type { Payload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('ADMIN_JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: Payload) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    const isBlacklisted = await this.redisService.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const admin = await this.prisma.admin.findUnique({
      where: {
        id: payload.sub,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin no longer exists');
    }

    const { password: _password, ...result } = admin;

    req['accessToken'] = token;

    return result;
  }
}
