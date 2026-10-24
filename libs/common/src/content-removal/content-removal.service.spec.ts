import { ContentRemovalService } from './content-removal.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SearchService } from '../elasticsearch/search.service';
import { ES_INDEX } from '../elasticsearch/indices/index-names';
import {
  deleteCommunityGroupCover,
  deleteCommunityPostPhoto,
  deletePropertyPhoto,
} from '../upload/multer-config';

jest.mock('../upload/multer-config', () => ({
  ...jest.requireActual('../upload/multer-config'),
  deletePropertyPhoto: jest.fn(),
  deleteCommunityPostPhoto: jest.fn(),
  deleteCommunityPostVideo: jest.fn(),
  deleteCommunityEventBanner: jest.fn(),
  deleteCommunityGroupCover: jest.fn(),
}));

function createModelMock() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
}

describe('ContentRemovalService', () => {
  let prisma: Record<string, any>;
  let redis: { del: jest.Mock };
  let searchService: { removeDocument: jest.Mock };
  let contentRemoval: ContentRemovalService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    for (const model of [
      'property',
      'propertyPhoto',
      'notification',
      'communityGroup',
      'communityGroupCoverPhoto',
      'communityPost',
      'communityPostPhoto',
      'communityPostVideo',
      'communityEvent',
      'communityEventBanner',
    ]) {
      prisma[model] = createModelMock();
    }
    redis = { del: jest.fn().mockResolvedValue(1) };
    searchService = { removeDocument: jest.fn().mockResolvedValue(undefined) };

    contentRemoval = new ContentRemovalService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      searchService as unknown as SearchService,
    );
  });

  it('should do nothing when there is nothing to remove', async () => {
    await contentRemoval.removeProperties([]);

    expect(prisma.property.deleteMany).not.toHaveBeenCalled();
  });

  it('should remove properties with their photos, notifications, search documents and counters', async () => {
    prisma.propertyPhoto.findMany.mockResolvedValue([
      { filename: 'photo-1.webp' },
      { filename: 'photo-2.webp' },
    ]);

    await contentRemoval.removeProperties(['property-1']);

    expect(prisma.property.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['property-1'] } },
    });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { propertyId: { in: ['property-1'] } },
    });
    expect(deletePropertyPhoto).toHaveBeenCalledWith('photo-1.webp');
    expect(deletePropertyPhoto).toHaveBeenCalledWith('photo-2.webp');
    expect(searchService.removeDocument).toHaveBeenCalledWith(
      ES_INDEX.PROPERTIES,
      'property-1',
    );
    expect(redis.del).toHaveBeenCalledWith('property:views:property-1');
  });

  it('should remove the posts and events of a group before the group', async () => {
    prisma.communityGroupCoverPhoto.findMany.mockResolvedValue([
      { filename: 'cover.webp' },
    ]);
    prisma.communityPost.findMany.mockResolvedValue([{ id: 'post-1' }]);
    prisma.communityPostPhoto.findMany.mockResolvedValue([
      { filename: 'post-photo.webp' },
    ]);
    prisma.communityEvent.findMany.mockResolvedValue([{ id: 'event-1' }]);

    await contentRemoval.removeCommunityGroups(['group-1']);

    expect(prisma.communityPost.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['post-1'] } },
    });
    expect(prisma.communityEvent.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['event-1'] } },
    });
    expect(prisma.communityGroup.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['group-1'] } },
    });
    expect(deleteCommunityPostPhoto).toHaveBeenCalledWith('post-photo.webp');
    expect(deleteCommunityGroupCover).toHaveBeenCalledWith('cover.webp');
  });
});
