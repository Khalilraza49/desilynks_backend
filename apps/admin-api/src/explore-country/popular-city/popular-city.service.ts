import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  deleteExploreCountryCityBanner,
  deleteTempFile,
  moveFileToExploreCountryCityBanners,
} from '@libs/common';
import { Prisma } from '@generated/prisma';
import { CreatePopularCityDto } from './dto/create-popular-city.dto';
import { UpdatePopularCityDto } from './dto/update-popular-city.dto';

@Injectable()
export class PopularCityService {
  constructor(private readonly prisma: PrismaService) {}

  async addPopularCity(
    countryId: string,
    dto: CreatePopularCityDto,
    bannerFile: Express.Multer.File,
  ) {
    const country = await this.prisma.exploreCountry.findUnique({
      where: { id: countryId },
    });

    if (!country) {
      deleteTempFile(bannerFile.filename);
      throw new NotFoundException('Explore country not found');
    }

    const duplicate = await this.prisma.exploreCountryPopularCity.findFirst({
      where: { exploreCountryId: countryId, name: dto.name },
    });

    if (duplicate) {
      deleteTempFile(bannerFile.filename);
      throw new ConflictException(
        'A popular city with this name already exists for this country',
      );
    }

    let movedBannerFilename: string | null = null;

    try {
      const bannerUrl = moveFileToExploreCountryCityBanners(
        bannerFile.filename,
      );
      movedBannerFilename = bannerFile.filename;

      const city = await this.prisma.exploreCountryPopularCity.create({
        data: {
          name: dto.name,
          exploreCountryId: countryId,
          banner: {
            create: {
              url: bannerUrl,
              filename: bannerFile.filename,
              mimetype: bannerFile.mimetype,
            },
          },
        },
        include: {
          banner: { select: { id: true, url: true } },
        },
      });

      return {
        message: 'Popular city added successfully',
        data: city,
      };
    } catch (err) {
      if (movedBannerFilename) {
        deleteExploreCountryCityBanner(movedBannerFilename);
      } else {
        deleteTempFile(bannerFile.filename);
      }

      if (err instanceof ConflictException) throw err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'A popular city with this name already exists for this country',
        );
      }
      throw new InternalServerErrorException(
        'Failed to add popular city. Please try again',
      );
    }
  }

  async updatePopularCityName(cityId: string, dto: UpdatePopularCityDto) {
    const city = await this.prisma.exploreCountryPopularCity.findUnique({
      where: { id: cityId },
    });

    if (!city) {
      throw new NotFoundException('Popular city not found');
    }

    const duplicate = await this.prisma.exploreCountryPopularCity.findFirst({
      where: {
        exploreCountryId: city.exploreCountryId,
        id: { not: cityId },
        name: dto.name,
      },
    });

    if (duplicate) {
      throw new ConflictException(
        'A popular city with this name already exists for this country',
      );
    }

    try {
      const updatedCity = await this.prisma.exploreCountryPopularCity.update({
        where: { id: cityId },
        data: { name: dto.name },
        include: { banner: { select: { id: true, url: true } } },
      });

      return {
        message: 'Popular city updated successfully',
        data: updatedCity,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'A popular city with this name already exists for this country',
        );
      }
      throw err;
    }
  }

  async updatePopularCityBanner(
    cityId: string,
    bannerFile: Express.Multer.File,
  ) {
    const city = await this.prisma.exploreCountryPopularCity.findUnique({
      where: { id: cityId },
      include: { banner: true },
    });

    if (!city) {
      deleteTempFile(bannerFile.filename);
      throw new NotFoundException('Popular city not found');
    }

    let movedBannerFilename: string | null = null;
    const oldBannerFilename = city.banner?.filename ?? null;

    try {
      const bannerUrl = moveFileToExploreCountryCityBanners(
        bannerFile.filename,
      );
      movedBannerFilename = bannerFile.filename;

      const bannerRecord = {
        url: bannerUrl,
        filename: bannerFile.filename,
        mimetype: bannerFile.mimetype,
      };

      const updatedCity = await this.prisma.exploreCountryPopularCity.update({
        where: { id: cityId },
        data: {
          banner: {
            upsert: { create: bannerRecord, update: bannerRecord },
          },
        },
        include: { banner: { select: { id: true, url: true } } },
      });

      if (oldBannerFilename) {
        deleteExploreCountryCityBanner(oldBannerFilename);
      }

      return {
        message: 'Popular city banner updated successfully',
        data: updatedCity,
      };
    } catch (err) {
      if (movedBannerFilename) {
        deleteExploreCountryCityBanner(movedBannerFilename);
      } else {
        deleteTempFile(bannerFile.filename);
      }

      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'Failed to update popular city banner. Please try again',
      );
    }
  }

  async deletePopularCity(cityId: string) {
    const city = await this.prisma.exploreCountryPopularCity.findUnique({
      where: { id: cityId },
      include: { banner: { select: { filename: true } } },
    });

    if (!city) {
      throw new NotFoundException('Popular city not found');
    }

    await this.prisma.exploreCountryPopularCity.delete({
      where: { id: cityId },
    });

    if (city.banner?.filename) {
      deleteExploreCountryCityBanner(city.banner.filename);
    }

    return { message: 'Popular city deleted successfully' };
  }
}
