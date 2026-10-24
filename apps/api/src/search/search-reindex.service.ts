import { Injectable, Logger } from '@nestjs/common';
import {
  ES_INDEX,
  PrismaService,
  SearchService,
  type EsIndexName,
} from '@libs/common';

const REINDEX_BATCH_SIZE = 200;

type BatchFetcher = (cursor?: string) => Promise<Array<{ id: string }>>;

@Injectable()
export class SearchReindexService {
  private readonly logger = new Logger(SearchReindexService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) {}

  async reindexAll(fresh: boolean): Promise<void> {
    await this.reindex(ES_INDEX.PROPERTIES, fresh, (cursor) =>
      this.prisma.property.findMany({
        include: {
          propertyPhotos: { select: { id: true, url: true } },
          featuresAndAmenities: { select: { id: true, title: true } },
        },
        ...this.page(cursor),
      }),
    );

    await this.reindex(ES_INDEX.JOBS, fresh, (cursor) =>
      this.prisma.job.findMany({
        include: {
          poster: { select: { id: true, url: true } },
          category: { select: { id: true, title: true } },
        },
        ...this.page(cursor),
      }),
    );

    await this.reindex(ES_INDEX.WORKER_PROFILES, fresh, (cursor) =>
      this.prisma.workerProfile.findMany({
        include: {
          profilePhoto: { select: { id: true, url: true } },
          workPhotos: { select: { id: true, url: true } },
          certificates: { select: { id: true, url: true } },
        },
        ...this.page(cursor),
      }),
    );

    await this.reindex(ES_INDEX.PRODUCT_ADS, fresh, (cursor) =>
      this.prisma.productAd.findMany({
        include: {
          photos: { select: { id: true, url: true } },
          video: { select: { id: true, url: true } },
        },
        ...this.page(cursor),
      }),
    );

    await this.reindex(ES_INDEX.NEED_A_WORKER, fresh, (cursor) =>
      this.prisma.needAWorker.findMany({
        include: {
          referencePhotos: { select: { id: true, url: true } },
          workerType: { select: { id: true, title: true } },
        },
        ...this.page(cursor),
      }),
    );

    await this.reindex(ES_INDEX.BUSINESS_LISTINGS, fresh, (cursor) =>
      this.prisma.businessListing.findMany({
        include: {
          businessHours: true,
          coverPhoto: { select: { id: true, url: true } },
          businessGalleries: { select: { id: true, url: true } },
          category: { select: { id: true, title: true } },
        },
        ...this.page(cursor),
      }),
    );
  }

  private page(cursor?: string) {
    return {
      take: REINDEX_BATCH_SIZE,
      orderBy: { id: 'asc' as const },
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    };
  }

  private async reindex(
    index: EsIndexName,
    fresh: boolean,
    fetchBatch: BatchFetcher,
  ): Promise<void> {
    if (fresh) {
      await this.searchService.resetIndex(index);
    }

    let cursor: string | undefined;
    let indexed = 0;
    let errors = 0;

    while (true) {
      const records = await fetchBatch(cursor);
      if (records.length === 0) break;

      const result = await this.searchService.bulkIndex(
        index,
        records.map((record) => ({ id: record.id, body: record })),
      );

      indexed += result.indexed;
      errors += result.errors;
      cursor = records[records.length - 1].id;
    }

    this.logger.log(
      `Reindexed "${index}": ${indexed} indexed, ${errors} failed`,
    );
  }
}
