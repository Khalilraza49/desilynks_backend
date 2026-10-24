import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { CreateBusinessCategoryDto } from './dto/create-business-category.dto';
import { CategoryStatus } from '@generated/prisma';

@Injectable()
export class BusinessCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(adminId: string, dto: CreateBusinessCategoryDto) {
    const { title } = dto;

    const existing = await this.prisma.businessCategory.findUnique({
      where: { title },
    });

    if (existing) {
      throw new ConflictException(
        'Business category with this title already exists',
      );
    }

    const businessCategory = await this.prisma.businessCategory.create({
      data: {
        title,
        createdById: adminId,
      },
    });

    return {
      message: 'Business category created successfully',
      data: businessCategory,
    };
  }

  async getAll() {
    const [count, businessCategories] = await Promise.all([
      this.prisma.businessCategory.count(),
      this.prisma.businessCategory.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      data: businessCategories,
      meta: {
        total: count,
      },
    };
  }

  async toggleStatus(id: string) {
    const category = await this.prisma.businessCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Business category not found');
    }

    const newStatus =
      category.status === CategoryStatus.ACTIVE
        ? CategoryStatus.INACTIVE
        : CategoryStatus.ACTIVE;

    const businessCategory = await this.prisma.businessCategory.update({
      where: { id },
      data: {
        status: newStatus,
      },
    });

    return {
      message: `Category status successfully set to ${newStatus.toLowerCase()}`,
      data: businessCategory,
    };
  }
}

