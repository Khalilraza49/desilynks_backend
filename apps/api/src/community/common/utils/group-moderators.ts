import { PrismaService } from '@libs/common';
import {
  CommunityGroupMemberRole,
  CommunityGroupMemberStatus,
} from '@generated/prisma';

export async function findGroupModeratorIds(
  prisma: PrismaService,
  groupId: string,
): Promise<string[]> {
  const moderators = await prisma.communityGroupMember.findMany({
    where: {
      groupId,
      status: CommunityGroupMemberStatus.ACTIVE,
      role: {
        in: [
          CommunityGroupMemberRole.ADMIN,
          CommunityGroupMemberRole.MODERATOR,
        ],
      },
    },
    select: { userId: true },
  });

  return moderators.map((moderator) => moderator.userId);
}
