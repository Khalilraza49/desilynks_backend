import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { Prisma, UserSupportStatus } from '@generated/prisma';
import { GetSupportFormsQueryDto } from './dto/get-support-forms-query.dto';

const personSelect = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    profilePhoto: { select: { url: true } },
  },
};

const adminSelect = {
  select: { id: true, firstName: true, lastName: true },
};

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async getSupportForms(query: GetSupportFormsQueryDto) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserSupportFormWhereInput = {
      ...(status && { status }),
    };

    const [supportForms, count] = await Promise.all([
      this.prisma.userSupportForm.findMany({
        where,
        include: {
          user: personSelect,
          resolvedByAdmin: adminSelect,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userSupportForm.count({ where }),
    ]);

    return {
      data: supportForms,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getSupportFormById(id: string) {
    const supportForm = await this.prisma.userSupportForm.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            status: true,
            deletedAt: true,
            createdAt: true,
            profilePhoto: { select: { url: true } },
          },
        },
        resolvedByAdmin: adminSelect,
      },
    });

    if (!supportForm) {
      throw new NotFoundException('Support form not found');
    }

    return { data: supportForm };
  }

  async resolveSupportForm(adminId: string, id: string) {
    const supportForm = await this.prisma.userSupportForm.findUnique({
      where: { id },
    });

    if (!supportForm) {
      throw new NotFoundException('Support form not found');
    }

    if (supportForm.status !== UserSupportStatus.PENDING) {
      throw new BadRequestException('Support form has already been resolved');
    }

    const resolvedSupportForm = await this.prisma.userSupportForm.update({
      where: { id },
      data: {
        status: UserSupportStatus.RESOLVED,
        resolvedByAdminId: adminId,
        resolvedAt: new Date(),
      },
    });

    return {
      message: 'Support form resolved successfully',
      data: resolvedSupportForm,
    };
  }
}
