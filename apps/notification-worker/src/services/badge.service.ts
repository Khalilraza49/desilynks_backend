import { Injectable } from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { MessageStatus } from '@generated/prisma';

@Injectable()
export class BadgeService {
  constructor(private readonly prisma: PrismaService) {}

  async getBadgeCount(userId: string): Promise<number> {
    const [unreadNotifications, unreadMessages] = await Promise.all([
      this.prisma.notification.count({
        where: { recipientId: userId, isRead: false },
      }),
      this.prisma.message.count({
        where: {
          conversation: {
            OR: [{ participantOneId: userId }, { participantTwoId: userId }],
          },
          senderId: { not: userId },
          status: { not: MessageStatus.READ },
          isDeleted: false,
        },
      }),
    ]);

    return unreadNotifications + unreadMessages;
  }
}
