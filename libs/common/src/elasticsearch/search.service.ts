import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import type { estypes } from '@elastic/elasticsearch';
import {
  INDEX_DEFINITIONS,
  type IndexDefinition,
} from './indices/index-definitions';
import { ES_INDEX, type EsIndexName } from './indices/index-names';
import {
  MAX_SEARCH_WINDOW,
  PUBLIC_STATUSES,
  SUGGEST_FIELDS,
} from './indices/search-rules';
import type { SuggestQueryDto } from './dto/suggest-query.dto';
import type { SearchPropertiesDto } from './dto/search-properties.dto';
import type { SearchJobsDto } from './dto/search-jobs.dto';
import type { SearchWorkerProfilesDto } from './dto/search-worker-profiles.dto';
import type { SearchProductAdsDto } from './dto/search-product-ads.dto';
import type { SearchNeedAWorkerDto } from './dto/search-need-a-worker.dto';
import type { SearchBusinessListingsDto } from './dto/search-business-listings.dto';

export interface SearchResult<T = Record<string, any>> {
  data: Array<T & { _id: string; _score: number | null }>;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SuggestResult {
  suggestions: string[];
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly esService: ElasticsearchService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureIndices();
  }

  private async ensureIndices(): Promise<void> {
    for (const def of INDEX_DEFINITIONS) {
      await this.ensureIndex(def);
    }
  }

  private async ensureIndex(def: IndexDefinition): Promise<void> {
    try {
      const exists = await this.esService.indices.exists({ index: def.index });
      if (exists) {
        this.logger.log(`Index "${def.index}" already exists — skipping`);
        return;
      }

      await this.esService.indices.create({
        index: def.index,
        settings: def.settings,
        mappings: def.mappings,
      });
      this.logger.log(`Index "${def.index}" created successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to ensure index "${def.index}"`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  async resetIndex(index: EsIndexName): Promise<void> {
    const def = INDEX_DEFINITIONS.find(
      (definition) => definition.index === index,
    );
    if (!def) return;

    const exists = await this.esService.indices.exists({ index });
    if (exists) {
      await this.esService.indices.delete({ index });
    }

    await this.ensureIndex(def);
  }

  async indexDocument(
    index: EsIndexName,
    id: string,
    body: Record<string, any>,
  ): Promise<void> {
    try {
      await this.esService.index({
        index,
        id,
        document: body,
        refresh: 'wait_for',
      });
      this.logger.debug(`Indexed document ${id} in "${index}"`);
    } catch (error) {
      this.logger.error(
        `Failed to index document ${id} in "${index}"`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  async updateDocument(
    index: EsIndexName,
    id: string,
    partialBody: Record<string, any>,
  ): Promise<void> {
    try {
      await this.esService.update({
        index,
        id,
        doc: partialBody,
        refresh: 'wait_for',
      });
      this.logger.debug(`Updated document ${id} in "${index}"`);
    } catch (error) {
      this.logger.error(
        `Failed to update document ${id} in "${index}"`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  async removeDocument(index: EsIndexName, id: string): Promise<void> {
    try {
      await this.esService.delete({
        index,
        id,
        refresh: 'wait_for',
      });
      this.logger.debug(`Removed document ${id} from "${index}"`);
    } catch (error: any) {
      if (error?.meta?.statusCode === 404) {
        this.logger.debug(
          `Document ${id} not found in "${index}" — already deleted`,
        );
        return;
      }
      this.logger.error(
        `Failed to remove document ${id} from "${index}"`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  async bulkIndex(
    index: EsIndexName,
    documents: Array<{ id: string; body: Record<string, any> }>,
  ): Promise<{ indexed: number; errors: number }> {
    if (documents.length === 0) return { indexed: 0, errors: 0 };

    const operations = documents.flatMap((doc) => [
      { index: { _index: index, _id: doc.id } },
      doc.body,
    ]);

    try {
      const result = await this.esService.bulk({
        operations,
        refresh: 'wait_for',
      });

      const errorCount = result.items.filter(
        (item) => item.index?.error,
      ).length;
      const indexedCount = result.items.length - errorCount;

      if (errorCount > 0) {
        const sampleErrors = result.items
          .filter((item) => item.index?.error)
          .slice(0, 3)
          .map((item) => item.index?.error?.reason);
        this.logger.warn(
          `Bulk index to "${index}": ${indexedCount} ok, ${errorCount} errors. Sample: ${sampleErrors.join('; ')}`,
        );
      } else {
        this.logger.debug(
          `Bulk indexed ${indexedCount} documents to "${index}"`,
        );
      }

      return { indexed: indexedCount, errors: errorCount };
    } catch (error) {
      this.logger.error(
        `Bulk index to "${index}" failed`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException('Bulk index operation failed');
    }
  }

  async searchProperties(dto: SearchPropertiesDto): Promise<SearchResult> {
    const { page = 1, limit = 10 } = dto;
    const must: estypes.QueryDslQueryContainer[] = [];
    const filter: estypes.QueryDslQueryContainer[] = [];

    if (dto.query) {
      must.push({
        multi_match: {
          query: dto.query,
          fields: ['title^3', 'description', 'location^2'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (dto.type) filter.push({ term: { type: dto.type } });
    filter.push(...this.buildStatusFilter(ES_INDEX.PROPERTIES, dto.status));
    if (dto.contactPreference)
      filter.push({ term: { contactPreference: dto.contactPreference } });
    if (dto.location && !dto.query) {
      filter.push({ match: { location: dto.location } });
    }

    if (dto.minRent !== undefined || dto.maxRent !== undefined) {
      const range: Record<string, number> = {};
      if (dto.minRent !== undefined) range.gte = dto.minRent;
      if (dto.maxRent !== undefined) range.lte = dto.maxRent;
      filter.push({ range: { monthlyRent: range } });
    }
    if (dto.minBedrooms !== undefined) {
      filter.push({ range: { noOfBedRooms: { gte: dto.minBedrooms } } });
    }
    if (dto.minBathrooms !== undefined) {
      filter.push({ range: { noOfBathRooms: { gte: dto.minBathrooms } } });
    }

    const sort = this.buildSort(dto.sortBy, dto.sortOrder, 'createdAt');

    return this.executeSearch(
      ES_INDEX.PROPERTIES,
      must,
      filter,
      sort,
      page,
      limit,
    );
  }

  async searchJobs(dto: SearchJobsDto): Promise<SearchResult> {
    const { page = 1, limit = 10 } = dto;
    const must: estypes.QueryDslQueryContainer[] = [];
    const filter: estypes.QueryDslQueryContainer[] = [];

    if (dto.query) {
      must.push({
        multi_match: {
          query: dto.query,
          fields: [
            'title^3',
            'description',
            'companyName^2',
            'requiredSkills',
            'location^2',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (dto.categoryId) filter.push({ term: { categoryId: dto.categoryId } });
    if (dto.type) filter.push({ term: { type: dto.type } });
    if (dto.workMode) filter.push({ term: { workMode: dto.workMode } });
    if (dto.experience) filter.push({ term: { experience: dto.experience } });
    if (dto.salaryPeriod)
      filter.push({ term: { salaryPeriod: dto.salaryPeriod } });
    filter.push(...this.buildStatusFilter(ES_INDEX.JOBS, dto.status));
    if (dto.location && !dto.query) {
      filter.push({ match: { location: dto.location } });
    }

    if (dto.salary !== undefined) {
      filter.push({ range: { salary: { gte: dto.salary } } });
    }

    const sort = this.buildSort(dto.sortBy, dto.sortOrder, 'createdAt');

    return this.executeSearch(ES_INDEX.JOBS, must, filter, sort, page, limit);
  }

  async searchWorkerProfiles(
    dto: SearchWorkerProfilesDto,
  ): Promise<SearchResult> {
    const { page = 1, limit = 10 } = dto;
    const must: estypes.QueryDslQueryContainer[] = [];
    const filter: estypes.QueryDslQueryContainer[] = [];

    if (dto.query) {
      must.push({
        multi_match: {
          query: dto.query,
          fields: ['about^2', 'areaCovered'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (dto.service) filter.push({ term: { service: dto.service } });
    if (dto.isAvailableToday !== undefined)
      filter.push({ term: { isAvailableToday: dto.isAvailableToday } });
    if (dto.ownVehicle !== undefined)
      filter.push({ term: { ownVehicle: dto.ownVehicle } });
    if (dto.ownTools !== undefined)
      filter.push({ term: { ownTools: dto.ownTools } });
    if (dto.areaCovered && !dto.query) {
      filter.push({ match: { areaCovered: dto.areaCovered } });
    }

    if (dto.maxHourlyRate !== undefined) {
      filter.push({ range: { hourlyRate: { lte: dto.maxHourlyRate } } });
    }
    if (dto.maxDailyRate !== undefined) {
      filter.push({ range: { dailyRate: { lte: dto.maxDailyRate } } });
    }
    if (dto.minExperienceYears !== undefined) {
      filter.push({
        range: { experienceInYears: { gte: dto.minExperienceYears } },
      });
    }

    const sort = this.buildSort(dto.sortBy, dto.sortOrder, 'createdAt');

    return this.executeSearch(
      ES_INDEX.WORKER_PROFILES,
      must,
      filter,
      sort,
      page,
      limit,
    );
  }

  async searchProductAds(dto: SearchProductAdsDto): Promise<SearchResult> {
    const { page = 1, limit = 10 } = dto;
    const must: estypes.QueryDslQueryContainer[] = [];
    const filter: estypes.QueryDslQueryContainer[] = [];

    if (dto.query) {
      must.push({
        multi_match: {
          query: dto.query,
          fields: ['title^3', 'description', 'brand^2', 'location^2'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (dto.category) filter.push({ term: { category: dto.category } });
    if (dto.condition) filter.push({ term: { condition: dto.condition } });
    filter.push(...this.buildStatusFilter(ES_INDEX.PRODUCT_ADS, dto.status));
    if (dto.negotiable !== undefined)
      filter.push({ term: { negotiable: dto.negotiable } });
    if (dto.brand && !dto.query) {
      filter.push({ match: { brand: dto.brand } });
    }
    if (dto.location && !dto.query) {
      filter.push({ match: { location: dto.location } });
    }

    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      const range: Record<string, number> = {};
      if (dto.minPrice !== undefined) range.gte = dto.minPrice;
      if (dto.maxPrice !== undefined) range.lte = dto.maxPrice;
      filter.push({ range: { price: range } });
    }

    const sort = this.buildSort(dto.sortBy, dto.sortOrder, 'createdAt');

    return this.executeSearch(
      ES_INDEX.PRODUCT_ADS,
      must,
      filter,
      sort,
      page,
      limit,
    );
  }

  async searchNeedAWorkerPosts(
    dto: SearchNeedAWorkerDto,
  ): Promise<SearchResult> {
    const { page = 1, limit = 10 } = dto;
    const must: estypes.QueryDslQueryContainer[] = [];
    const filter: estypes.QueryDslQueryContainer[] = [];

    if (dto.query) {
      must.push({
        multi_match: {
          query: dto.query,
          fields: ['description^2', 'location^2'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (dto.workerTypeId)
      filter.push({ term: { workerTypeId: dto.workerTypeId } });
    if (dto.budgetType) filter.push({ term: { budgetType: dto.budgetType } });
    if (dto.isUrgentRequest !== undefined)
      filter.push({ term: { isUrgentRequest: dto.isUrgentRequest } });
    if (dto.location && !dto.query) {
      filter.push({ match: { location: dto.location } });
    }

    if (dto.minBudget !== undefined || dto.maxBudget !== undefined) {
      const range: Record<string, number> = {};
      if (dto.minBudget !== undefined) range.gte = dto.minBudget;
      if (dto.maxBudget !== undefined) range.lte = dto.maxBudget;
      filter.push({ range: { budget: range } });
    }

    const sort = this.buildSort(dto.sortBy, dto.sortOrder, 'createdAt');

    return this.executeSearch(
      ES_INDEX.NEED_A_WORKER,
      must,
      filter,
      sort,
      page,
      limit,
    );
  }

  async searchBusinessListings(
    dto: SearchBusinessListingsDto,
  ): Promise<SearchResult> {
    const { page = 1, limit = 10 } = dto;
    const must: estypes.QueryDslQueryContainer[] = [];
    const filter: estypes.QueryDslQueryContainer[] = [];

    if (dto.query) {
      must.push({
        multi_match: {
          query: dto.query,
          fields: ['name^3', 'description', 'address^2'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (dto.categoryId) filter.push({ term: { categoryId: dto.categoryId } });
    filter.push(
      ...this.buildStatusFilter(ES_INDEX.BUSINESS_LISTINGS, dto.status),
    );
    if (dto.address && !dto.query) {
      filter.push({ match: { address: dto.address } });
    }

    const sort = this.buildSort(dto.sortBy, dto.sortOrder, 'createdAt');

    return this.executeSearch(
      ES_INDEX.BUSINESS_LISTINGS,
      must,
      filter,
      sort,
      page,
      limit,
    );
  }

  async suggest(dto: SuggestQueryDto): Promise<SuggestResult> {
    const { query, index = ES_INDEX.PROPERTIES, size = 5 } = dto;
    const allowedFields = SUGGEST_FIELDS[index];
    const field = dto.field ?? allowedFields[0];

    if (!allowedFields.includes(field)) {
      throw new BadRequestException(
        `field must be one of: ${allowedFields.join(', ')}`,
      );
    }

    try {
      const result = await this.esService.search({
        index,
        query: {
          bool: {
            must: [
              {
                match: {
                  [field]: {
                    query,
                    analyzer: 'autocomplete_search',
                  },
                },
              },
            ],
            filter: this.buildStatusFilter(index),
          },
        },
        _source: [field],
        size,
      });

      const suggestions = result.hits.hits
        .map((hit) => {
          const source = hit._source as Record<string, any>;
          return source?.[field] as string;
        })
        .filter(Boolean);

      return { suggestions: [...new Set(suggestions)] };
    } catch (error) {
      this.logger.error(
        `Suggest failed for "${index}/${field}"`,
        error instanceof Error ? error.stack : error,
      );
      return { suggestions: [] };
    }
  }

  private async executeSearch(
    index: EsIndexName,
    must: estypes.QueryDslQueryContainer[],
    filter: estypes.QueryDslQueryContainer[],
    sort: estypes.SortCombinations[],
    page: number,
    limit: number,
  ): Promise<SearchResult> {
    const from = (page - 1) * limit;

    if (from + limit > MAX_SEARCH_WINDOW) {
      throw new BadRequestException(
        `Search results are limited to the first ${MAX_SEARCH_WINDOW} matches`,
      );
    }

    const boolQuery: estypes.QueryDslBoolQuery = {};
    if (must.length > 0) boolQuery.must = must;
    if (filter.length > 0) boolQuery.filter = filter;

    const query: estypes.QueryDslQueryContainer =
      must.length === 0 && filter.length === 0
        ? { match_all: {} }
        : { bool: boolQuery };

    try {
      const result = await this.esService.search({
        index,
        query,
        from,
        size: limit,
        sort,
        track_total_hits: true,
      });

      const total =
        typeof result.hits.total === 'number'
          ? result.hits.total
          : (result.hits.total?.value ?? 0);

      const data = result.hits.hits.map(
        (hit: estypes.SearchHit<Record<string, any>>) => ({
          _id: hit._id!,
          _score: hit._score ?? null,
          ...(hit._source as object),
        }),
      );

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        `Search in "${index}" failed`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException('Search operation failed');
    }
  }

  private buildSort(
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    defaultField: string = 'createdAt',
  ): estypes.SortCombinations[] {
    const field = sortBy || defaultField;
    const order = sortOrder || 'desc';
    return [{ [field]: { order } }];
  }

  private buildStatusFilter(
    index: EsIndexName,
    status?: string,
  ): estypes.QueryDslQueryContainer[] {
    const publicStatuses = PUBLIC_STATUSES[index];

    if (!publicStatuses) return [];

    return [
      status ? { term: { status } } : { terms: { status: publicStatuses } },
    ];
  }
}
