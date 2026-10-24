import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { CreateJobCategoryDto } from './dto/create-job-category.dto';
import { CategoryStatus } from '@generated/prisma';

@Injectable()
export class JobCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(adminId: string, dto: CreateJobCategoryDto) {
    const { title } = dto;

    const existing = await this.prisma.jobCategory.findUnique({
      where: { title },
    });

    if (existing) {
      throw new ConflictException(
        'Job category with this title already exists',
      );
    }

    const jobCategory = await this.prisma.jobCategory.create({
      data: {
        title,
        createdById: adminId,
      },
    });

    return {
      message: 'Job category created successfully',
      data: jobCategory,
    };
  }

  async getAll() {
    const [count, jobCategories] = await Promise.all([
      this.prisma.jobCategory.count(),
      this.prisma.jobCategory.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      data: jobCategories,
      meta: {
        total: count,
      },
    };
  }

  async toggleStatus(id: string) {
    const category = await this.prisma.jobCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Job category not found');
    }

    const newStatus =
      category.status === CategoryStatus.ACTIVE
        ? CategoryStatus.INACTIVE
        : CategoryStatus.ACTIVE;

    const jobCategory = await this.prisma.jobCategory.update({
      where: { id },
      data: {
        status: newStatus,
      },
    });

    return {
      message: `Category status successfully set to ${newStatus.toLowerCase()}`,
      data: jobCategory,
    };
  }
}
