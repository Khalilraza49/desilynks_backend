import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, SessionService } from '@libs/common';
import { UserStatus } from '@generated/prisma';

@Injectable()
export class UserModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async suspendUser(userId: string) {
    await this.findActiveAccount(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
    });

    await this.sessionService.endAllSessions(userId);

    return {
      message: 'User suspended successfully',
    };
  }

  async unsuspendUser(userId: string) {
    await this.findActiveAccount(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });

    return {
      message: 'User unsuspended successfully',
    };
  }

  private async findActiveAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
