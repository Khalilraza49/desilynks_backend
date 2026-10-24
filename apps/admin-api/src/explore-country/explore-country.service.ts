import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  deleteExploreCountryBanner,
  deleteExploreCountryCityBanner,
  deleteTempFile,
  moveFileToExploreCountryBanners,
} from '@libs/common';
import { Prisma } from '@generated/prisma';
import { CreateExploreCountryDto } from './dto/create-explore-country.dto';
import { UpdateExploreCountryDetailsDto } from './dto/update-explore-country-details.dto';
import { GetAllExploreCountriesQueryDto } from './dto/get-all-explore-countries-query.dto';

@Injectable()
export class ExploreCountryService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeCountry(country: any) {
    return { ...country, population: country.population.toString() };
  }

  async createExploreCountry(
    dto: CreateExploreCountryDto,
    bannerFile: Express.Multer.File,
  ) {
    const existing = await this.prisma.exploreCountry.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      deleteTempFile(bannerFile.filename);
      throw new ConflictException(
        'Explore country with this name already exists',
      );
    }

    let movedBannerFilename: string | null = null;

    try {
      const bannerUrl = moveFileToExploreCountryBanners(bannerFile.filename);
      movedBannerFilename = bannerFile.filename;

      const country = await this.prisma.exploreCountry.create({
        data: {
          name: dto.name,
          population: BigInt(dto.population),
          language: dto.language,
          currency: dto.currency,
          capital: dto.capital,
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
        message: 'Explore country created successfully',
        data: this.serializeCountry(country),
      };
    } catch (err) {
      if (movedBannerFilename) {
        deleteExploreCountryBanner(movedBannerFilename);
      } else {
        deleteTempFile(bannerFile.filename);
      }

      if (err instanceof ConflictException) throw err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Explore country with this name already exists',
        );
      }
      throw new InternalServerErrorException(
        'Failed to create explore country. Please try again',
      );
    }
  }

  async getAllExploreCountries(query: GetAllExploreCountriesQueryDto) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ExploreCountryWhereInput = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [countries, count] = await Promise.all([
      this.prisma.exploreCountry.findMany({
        where,
        include: {
          banner: { select: { id: true, url: true } },
          _count: { select: { emergencyNumbers: true, popularCities: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.exploreCountry.count({ where }),
    ]);

    return {
      data: countries.map((country) => this.serializeCountry(country)),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getExploreCountryById(id: string) {
    const country = await this.prisma.exploreCountry.findUnique({
      where: { id },
      include: {
        banner: { select: { id: true, url: true } },
        emergencyNumbers: true,
        popularCities: {
          include: { banner: { select: { id: true, url: true } } },
        },
      },
    });

    if (!country) {
      throw new NotFoundException('Explore country not found');
    }

    return { data: this.serializeCountry(country) };
  }

  async updateExploreCountryDetails(
    id: string,
    dto: UpdateExploreCountryDetailsDto,
  ) {
    const country = await this.prisma.exploreCountry.findUnique({
      where: { id },
    });

    if (!country) {
      throw new NotFoundException('Explore country not found');
    }

    if (dto.name !== country.name) {
      const duplicate = await this.prisma.exploreCountry.findUnique({
        where: { name: dto.name },
      });
      if (duplicate) {
        throw new ConflictException(
          'Explore country with this name already exists',
        );
      }
    }

    try {
      const updatedCountry = await this.prisma.exploreCountry.update({
        where: { id },
        data: {
          name: dto.name,
          population: BigInt(dto.population),
          language: dto.language,
          currency: dto.currency,
          capital: dto.capital,
        },
        include: {
          banner: { select: { id: true, url: true } },
        },
      });

      return {
        message: 'Explore country updated successfully',
        data: this.serializeCountry(updatedCountry),
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Explore country with this name already exists',
        );
      }
      throw err;
    }
  }

  async updateExploreCountryBanner(
    id: string,
    bannerFile: Express.Multer.File,
  ) {
    const country = await this.prisma.exploreCountry.findUnique({
      where: { id },
      include: { banner: true },
    });

    if (!country) {
      deleteTempFile(bannerFile.filename);
      throw new NotFoundException('Explore country not found');
    }

    let movedBannerFilename: string | null = null;
    const oldBannerFilename = country.banner?.filename ?? null;

    try {
      const bannerUrl = moveFileToExploreCountryBanners(bannerFile.filename);
      movedBannerFilename = bannerFile.filename;

      const bannerRecord = {
        url: bannerUrl,
        filename: bannerFile.filename,
        mimetype: bannerFile.mimetype,
      };

      const updatedCountry = await this.prisma.exploreCountry.update({
        where: { id },
        data: {
          banner: {
            upsert: { create: bannerRecord, update: bannerRecord },
          },
        },
        include: {
          banner: { select: { id: true, url: true } },
        },
      });

      if (oldBannerFilename) {
        deleteExploreCountryBanner(oldBannerFilename);
      }

      return {
        message: 'Explore country banner updated successfully',
        data: this.serializeCountry(updatedCountry),
      };
    } catch (err) {
      if (movedBannerFilename) {
        deleteExploreCountryBanner(movedBannerFilename);
      } else {
        deleteTempFile(bannerFile.filename);
      }

      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'Failed to update explore country banner. Please try again',
      );
    }
  }

  async deleteExploreCountry(id: string) {
    const country = await this.prisma.exploreCountry.findUnique({
      where: { id },
      include: {
        banner: { select: { filename: true } },
        popularCities: { include: { banner: { select: { filename: true } } } },
      },
    });

    if (!country) {
      throw new NotFoundException('Explore country not found');
    }

    await this.prisma.exploreCountry.delete({ where: { id } });

    if (country.banner?.filename) {
      deleteExploreCountryBanner(country.banner.filename);
    }

    for (const city of country.popularCities) {
      if (city.banner?.filename) {
        deleteExploreCountryCityBanner(city.banner.filename);
      }
    }

    return { message: 'Explore country deleted successfully' };
  }
}
