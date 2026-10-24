import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@libs/common';
import {
  CommunityPostType,
  CommunityPostStatus,
  CommunityPostVisibility,
  CommunityGroupMemberStatus,
} from '@generated/prisma';

@Injectable()
export class PollService {
  private readonly logger = new Logger(PollService.name);

  constructor(private readonly prisma: PrismaService) {}

  async castVote(userId: string, postId: string, optionId: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
      include: {
        poll: {
          include: {
            options: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!post || post.status !== CommunityPostStatus.ACTIVE) {
      throw new NotFoundException('Post not found');
    }

    if (post.type !== CommunityPostType.POLL || !post.poll) {
      throw new BadRequestException('This post is not a poll');
    }

    if (
      post.visibility === CommunityPostVisibility.PRIVATE &&
      post.authorId !== userId
    ) {
      throw new NotFoundException('Post not found');
    }

    if (post.visibility === CommunityPostVisibility.GROUP) {
      const member = await this.prisma.communityGroupMember.findUnique({
        where: {
          groupId_userId: { groupId: post.groupId!, userId },
        },
      });

      if (!member || member.status !== CommunityGroupMemberStatus.ACTIVE) {
        throw new ForbiddenException(
          'You must be an active member of this group to vote on this poll',
        );
      }
    }

    if (post.poll.expiresAt && new Date(post.poll.expiresAt) < new Date()) {
      throw new BadRequestException('This poll has expired');
    }

    const pollOptionIds = post.poll.options.map((o) => o.id);
    if (!pollOptionIds.includes(optionId)) {
      throw new BadRequestException(
        'This option does not belong to the specified poll',
      );
    }

    const existingVote = await this.prisma.communityPostPollVote.findFirst({
      where: {
        voterId: userId,
        optionId: { in: pollOptionIds },
      },
    });

    if (existingVote) {
      throw new BadRequestException('You have already voted on this poll');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.communityPostPollVote.create({
          data: {
            optionId,
            voterId: userId,
          },
        });

        await tx.communityPostPollOption.update({
          where: { id: optionId },
          data: { voteCount: { increment: 1 } },
        });
      });

      return this.getPollResults(userId, postId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error casting vote: ${error.message}`);
      throw new InternalServerErrorException('Failed to cast vote');
    }
  }

  async getPollResults(userId: string, postId: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
      include: {
        poll: {
          include: {
            options: {
              select: {
                id: true,
                text: true,
                voteCount: true,
                votes: {
                  where: { voterId: userId },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!post || post.status !== CommunityPostStatus.ACTIVE) {
      throw new NotFoundException('Post not found');
    }

    if (post.type !== CommunityPostType.POLL || !post.poll) {
      throw new BadRequestException('This post is not a poll');
    }

    if (
      post.visibility === CommunityPostVisibility.PRIVATE &&
      post.authorId !== userId
    ) {
      throw new NotFoundException('Post not found');
    }

    if (post.visibility === CommunityPostVisibility.GROUP) {
      const member = await this.prisma.communityGroupMember.findUnique({
        where: {
          groupId_userId: { groupId: post.groupId!, userId },
        },
      });

      if (!member || member.status !== CommunityGroupMemberStatus.ACTIVE) {
        throw new ForbiddenException(
          'You must be an active member of this group to view this poll',
        );
      }
    }

    const poll = post.poll;
    const isExpired = poll.expiresAt
      ? new Date(poll.expiresAt) < new Date()
      : false;

    const votedOption = poll.options.find((o) => o.votes.length > 0);
    const hasVoted = !!votedOption;

    if (!hasVoted && !isExpired) {
      return {
        data: {
          pollId: poll.id,
          question: poll.question,
          expiresAt: poll.expiresAt,
          isExpired,
          hasVoted: false,
          votedOptionId: null,
          totalVotes: null,
          options: poll.options.map((o) => ({
            id: o.id,
            text: o.text,
          })),
        },
      };
    }

    const totalVotes = poll.options.reduce((sum, o) => sum + o.voteCount, 0);

    return {
      data: {
        pollId: poll.id,
        question: poll.question,
        expiresAt: poll.expiresAt,
        isExpired,
        hasVoted,
        votedOptionId: votedOption?.id ?? null,
        totalVotes,
        options: poll.options.map((o) => ({
          id: o.id,
          text: o.text,
          voteCount: o.voteCount,
          percentage:
            totalVotes > 0
              ? Math.round((o.voteCount / totalVotes) * 100 * 10) / 10
              : 0,
        })),
      },
    };
  }
}
