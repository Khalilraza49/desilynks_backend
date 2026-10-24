import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@libs/common';
import { GetAllExploreCountriesQueryDto } from './dto/get-all-explore-countries-query.dto';

@Injectable()
export class ExploreCountryService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeCountry(country: any) {
    return { ...country, population: country.population.toString() };
  }

  async getAllExploreCountries(query: GetAllExploreCountriesQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [countries, count] = await Promise.all([
      this.prisma.exploreCountry.findMany({
        include: {
          banner: { select: { id: true, url: true } },
          _count: { select: { emergencyNumbers: true, popularCities: true } },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.exploreCountry.count(),
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
        emergencyNumbers: {
          select: { id: true, title: true, number: true },
          orderBy: { title: 'asc' },
        },
        popularCities: {
          select: {
            id: true,
            name: true,
            banner: { select: { id: true, url: true } },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!country) {
      throw new NotFoundException('Explore country not found');
    }

    return { data: this.serializeCountry(country) };
  }
}
