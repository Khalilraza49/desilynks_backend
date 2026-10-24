import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FcmTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async registerToken(
    userId: string,
    token: string,
    device?: string,
  ): Promise<void> {
    await this.prisma.fcmToken.upsert({
      where: { token },
      update: { userId, device, updatedAt: new Date() },
      create: { userId, token, device },
    });
  }

  async removeToken(token: string): Promise<void> {
    await this.prisma.fcmToken.deleteMany({ where: { token } });
  }

  async removeStaleTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;

    await this.prisma.fcmToken.deleteMany({
      where: { token: { in: tokens } },
    });
  }

  async removeAllTokensForUser(userId: string): Promise<void> {
    await this.prisma.fcmToken.deleteMany({ where: { userId } });
  }

  async getTokensByUserId(userId: string): Promise<string[]> {
    const records = await this.prisma.fcmToken.findMany({
      where: { userId },
      select: { token: true },
    });

    return records.map((r) => r.token);
  }
}
