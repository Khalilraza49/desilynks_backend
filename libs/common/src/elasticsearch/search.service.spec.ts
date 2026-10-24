import { BadRequestException } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { SearchService } from './search.service';
import { ES_INDEX } from './indices/index-names';

describe('SearchService', () => {
  let esService: {
    search: jest.Mock;
    index: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let searchService: SearchService;

  const lastSearchRequest = () => esService.search.mock.calls[0][0];

  beforeEach(() => {
    esService = {
      search: jest.fn().mockResolvedValue({
        hits: { total: { value: 0 }, hits: [] },
      }),
      index: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    searchService = new SearchService(
      esService as unknown as ElasticsearchService,
    );
  });

  describe('suggest', () => {
    it('should reject a field that is not allowed for the index', async () => {
      await expect(
        searchService.suggest({
          query: 'john',
          index: ES_INDEX.PROPERTIES,
          field: 'ownerId',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(esService.search).not.toHaveBeenCalled();
    });

    it('should use the default field of the index', async () => {
      await searchService.suggest({
        query: 'cafe',
        index: ES_INDEX.BUSINESS_LISTINGS,
      });

      const request = lastSearchRequest();
      expect(request._source).toEqual(['name']);
      expect(request.query.bool.filter).toEqual([
        { terms: { status: ['ACTIVE'] } },
      ]);
    });
  });

  describe('searchProperties', () => {
    it('should only return public properties by default', async () => {
      await searchService.searchProperties({});

      expect(lastSearchRequest().query.bool.filter).toContainEqual({
        terms: { status: ['PUBLISHED', 'RENTED'] },
      });
    });

    it('should narrow down to the requested public status', async () => {
      await searchService.searchProperties({ status: 'RENTED' });

      expect(lastSearchRequest().query.bool.filter).toContainEqual({
        term: { status: 'RENTED' },
      });
    });

    it('should reject pages beyond the search window', async () => {
      await expect(
        searchService.searchProperties({ page: 201, limit: 50 }),
      ).rejects.toThrow(BadRequestException);
      expect(esService.search).not.toHaveBeenCalled();
    });
  });

  describe('searchWorkerProfiles', () => {
    it('should not filter by status', async () => {
      await searchService.searchWorkerProfiles({});

      expect(lastSearchRequest().query).toEqual({ match_all: {} });
    });
  });

  describe('indexing', () => {
    it('should not throw when elasticsearch is unavailable', async () => {
      esService.index.mockRejectedValue(new Error('connection refused'));
      esService.update.mockRejectedValue(new Error('connection refused'));
      esService.delete.mockRejectedValue(new Error('connection refused'));

      await expect(
        searchService.indexDocument(ES_INDEX.PROPERTIES, 'id', {}),
      ).resolves.toBeUndefined();
      await expect(
        searchService.updateDocument(ES_INDEX.PROPERTIES, 'id', {}),
      ).resolves.toBeUndefined();
      await expect(
        searchService.removeDocument(ES_INDEX.PROPERTIES, 'id'),
      ).resolves.toBeUndefined();
    });
  });
});
