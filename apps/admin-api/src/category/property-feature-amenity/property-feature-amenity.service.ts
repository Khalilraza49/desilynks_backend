import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { CreatePropertyFeatureAmenityDto } from './dto/create-property-feature-amenity.dto';
import { CategoryStatus } from '@generated/prisma';

@Injectable()
export class PropertyFeatureAmenityService {
  constructor(private readonly prisma: PrismaService) {}

  async create(adminId: string, dto: CreatePropertyFeatureAmenityDto) {
    const { title } = dto;

    const existing = await this.prisma.propertyFeatureAndAmenity.findUnique({
      where: { title },
    });

    if (existing) {
      throw new ConflictException(
        'Property feature/amenity with this title already exists',
      );
    }

    const propertyFeatureAndAmenity =
      await this.prisma.propertyFeatureAndAmenity.create({
        data: {
          title,
          createdById: adminId,
        },
      });

    return {
      message: 'Property feature/amenity created successfully',
      data: propertyFeatureAndAmenity,
    };
  }

  async getAll() {
    const [count, propertyFeaturesAndAmenities] = await Promise.all([
      this.prisma.propertyFeatureAndAmenity.count(),
      this.prisma.propertyFeatureAndAmenity.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      data: propertyFeaturesAndAmenities,
      meta: {
        total: count,
      },
    };
  }

  async toggleStatus(id: string) {
    const propertyFeatureAndAmenity =
      await this.prisma.propertyFeatureAndAmenity.findUnique({
        where: { id },
      });

    if (!propertyFeatureAndAmenity) {
      throw new NotFoundException('Property feature/amenity not found');
    }

    const newStatus =
      propertyFeatureAndAmenity.status === CategoryStatus.ACTIVE
        ? CategoryStatus.INACTIVE
        : CategoryStatus.ACTIVE;

    const updated = await this.prisma.propertyFeatureAndAmenity.update({
      where: { id },
      data: {
        status: newStatus,
      },
    });

    return {
      message: `Category status successfully set to ${newStatus.toLowerCase()}`,
      data: updated,
    };
  }
}
