import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { CreateNeedAWorkerTypeDto } from './dto/create-need-a-worker-type.dto';
import { CategoryStatus } from '@generated/prisma';

@Injectable()
export class NeedAWorkerTypeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(adminId: string, dto: CreateNeedAWorkerTypeDto) {
    const { title } = dto;

    const existing = await this.prisma.needAWorkerType.findUnique({
      where: { title },
    });

    if (existing) {
      throw new ConflictException(
        'Need a worker type with this title already exists',
      );
    }

    const needAWorkerType = await this.prisma.needAWorkerType.create({
      data: {
        title,
        createdById: adminId,
      },
    });

    return {
      message: 'Need a worker type created successfully',
      data: needAWorkerType,
    };
  }

  async getAll() {
    const [count, needAWorkerTypes] = await Promise.all([
      this.prisma.needAWorkerType.count(),
      this.prisma.needAWorkerType.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      data: needAWorkerTypes,
      meta: {
        total: count,
      },
    };
  }

  async toggleStatus(id: string) {
    const category = await this.prisma.needAWorkerType.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Need a worker type not found');
    }

    const newStatus =
      category.status === CategoryStatus.ACTIVE
        ? CategoryStatus.INACTIVE
        : CategoryStatus.ACTIVE;

    const needAWorkerType = await this.prisma.needAWorkerType.update({
      where: { id },
      data: {
        status: newStatus,
      },
    });

    return {
      message: `Category status successfully set to ${newStatus.toLowerCase()}`,
      data: needAWorkerType,
    };
  }
}
