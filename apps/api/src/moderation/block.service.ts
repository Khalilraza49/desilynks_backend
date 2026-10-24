import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { GetBlockedUsersQueryDto } from './dto/get-blocked-users-query.dto';

@Injectable()
export class BlockService {
  constructor(private readonly prisma: PrismaService) {}

  async blockUser(userId: string, blockedUserId: string) {
    if (userId === blockedUserId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const blockedUser = await this.prisma.user.findUnique({
      where: { id: blockedUserId },
      select: { id: true, deletedAt: true },
    });

    if (!blockedUser || blockedUser.deletedAt) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: { blockerId: userId, blockedId: blockedUserId },
      },
      update: {},
      create: {
        blockerId: userId,
        blockedId: blockedUserId,
      },
    });

    return {
      blocked: true,
    };
  }

  async unblockUser(userId: string, blockedUserId: string) {
    await this.prisma.userBlock.deleteMany({
      where: {
        blockerId: userId,
        blockedId: blockedUserId,
      },
    });

    return {
      blocked: false,
    };
  }

  async getBlockedUsers(userId: string, query: GetBlockedUsersQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = { blockerId: userId };

    const [blocks, count] = await Promise.all([
      this.prisma.userBlock.findMany({
        where,
        select: {
          createdAt: true,
          blocked: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhoto: { select: { url: true } },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userBlock.count({ where }),
    ]);

    return {
      data: blocks.map((block) => ({
        ...block.blocked,
        blockedAt: block.createdAt,
      })),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.prisma.userBlock.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: { blockerId: true, blockedId: true },
    });

    return blocks.map((block) =>
      block.blockerId === userId ? block.blockedId : block.blockerId,
    );
  }

  async isBlockedBetween(userId: string, otherUserId: string) {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: otherUserId },
          { blockerId: otherUserId, blockedId: userId },
        ],
      },
      select: { id: true },
    });

    return !!block;
  }

  async assertNotBlocked(userId: string, otherUserId: string) {
    if (await this.isBlockedBetween(userId, otherUserId)) {
      throw new ForbiddenException('You cannot interact with this user');
    }
  }
}
