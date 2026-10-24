import { CategoryStatus } from '@generated/prisma';
import { PrismaService } from '@libs/common';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CategoriesAndTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async getBusinessCategories() {
    const businessListingCategories =
      await this.prisma.businessCategory.findMany({
        where: {
          status: CategoryStatus.ACTIVE,
        },
        select: {
          id: true,
          title: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    return {
      data: businessListingCategories,
    };
  }

  async getJobCategories() {
    const jobCategories = await this.prisma.jobCategory.findMany({
      where: {
        status: CategoryStatus.ACTIVE,
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      data: jobCategories,
    };
  }

  async getNeedAWorkerTypes() {
    const needAWorkerTypes = await this.prisma.needAWorkerType.findMany({
      where: {
        status: CategoryStatus.ACTIVE,
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      data: needAWorkerTypes,
    };
  }

  async getPropertyFeaturesAndAmenities() {
    const propertyFeaturesAndAmenities =
      await this.prisma.propertyFeatureAndAmenity.findMany({
        where: {
          status: CategoryStatus.ACTIVE,
        },
        select: {
          id: true,
          title: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    return {
      data: propertyFeaturesAndAmenities,
    };
  }
}
