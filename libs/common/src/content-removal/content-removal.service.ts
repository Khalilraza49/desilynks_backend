import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SearchService } from '../elasticsearch/search.service';
import { ES_INDEX } from '../elasticsearch/indices/index-names';
import {
  deleteBannerAdPhoto,
  deleteBusinessCoverPhoto,
  deleteBusinessGalleryPhoto,
  deleteCommunityEventBanner,
  deleteCommunityGroupCover,
  deleteCommunityPostPhoto,
  deleteCommunityPostVideo,
  deleteJobPoster,
  deleteNeedWorkerRefPhoto,
  deleteProductPhoto,
  deleteProductVideo,
  deletePropertyPhoto,
  deleteWorkerCertificate,
  deleteWorkerProfilePhoto,
  deleteWorkPhoto,
} from '../upload/multer-config';

@Injectable()
export class ContentRemovalService {
  private readonly logger = new Logger(ContentRemovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly searchService: SearchService,
  ) {}

  async removeProperties(propertyIds: string[]): Promise<void> {
    if (propertyIds.length === 0) return;

    const photos = await this.prisma.propertyPhoto.findMany({
      where: { propertyId: { in: propertyIds } },
      select: { filename: true },
    });

    await this.prisma.$transaction([
      this.prisma.property.deleteMany({ where: { id: { in: propertyIds } } }),
      this.prisma.notification.deleteMany({
        where: { propertyId: { in: propertyIds } },
      }),
    ]);

    for (const photo of photos) {
      deletePropertyPhoto(photo.filename);
    }

    for (const propertyId of propertyIds) {
      await this.searchService.removeDocument(ES_INDEX.PROPERTIES, propertyId);
      await this.clearCachedCounters([`property:views:${propertyId}`]);
    }
  }

  async removeJobs(jobIds: string[]): Promise<void> {
    if (jobIds.length === 0) return;

    const [posters, applications] = await Promise.all([
      this.prisma.jobPoster.findMany({
        where: { jobId: { in: jobIds } },
        select: { filename: true },
      }),
      this.prisma.jobApplications.findMany({
        where: { jobId: { in: jobIds } },
        select: { id: true },
      }),
    ]);

    await this.prisma.$transaction([
      this.prisma.job.deleteMany({ where: { id: { in: jobIds } } }),
      this.prisma.notification.deleteMany({
        where: {
          jobApplicationId: { in: applications.map((app) => app.id) },
        },
      }),
    ]);

    for (const poster of posters) {
      deleteJobPoster(poster.filename);
    }

    for (const jobId of jobIds) {
      await this.searchService.removeDocument(ES_INDEX.JOBS, jobId);
    }
  }

  async removeWorkerProfiles(workerProfileIds: string[]): Promise<void> {
    if (workerProfileIds.length === 0) return;

    const where = { workerProfileId: { in: workerProfileIds } };
    const [profilePhotos, workPhotos, certificates] = await Promise.all([
      this.prisma.workerProfilePhoto.findMany({
        where,
        select: { filename: true },
      }),
      this.prisma.workPhoto.findMany({ where, select: { filename: true } }),
      this.prisma.workCertificate.findMany({
        where,
        select: { filename: true },
      }),
    ]);

    await this.prisma.$transaction([
      this.prisma.workerProfile.deleteMany({
        where: { id: { in: workerProfileIds } },
      }),
      this.prisma.notification.deleteMany({ where }),
    ]);

    for (const photo of profilePhotos) {
      deleteWorkerProfilePhoto(photo.filename);
    }
    for (const photo of workPhotos) {
      deleteWorkPhoto(photo.filename);
    }
    for (const certificate of certificates) {
      deleteWorkerCertificate(certificate.filename);
    }

    for (const workerProfileId of workerProfileIds) {
      await this.searchService.removeDocument(
        ES_INDEX.WORKER_PROFILES,
        workerProfileId,
      );
    }
  }

  async removeNeedAWorkerPosts(needAWorkerIds: string[]): Promise<void> {
    if (needAWorkerIds.length === 0) return;

    const photos = await this.prisma.needAWorkerRefPhoto.findMany({
      where: { workRequestId: { in: needAWorkerIds } },
      select: { filename: true },
    });

    await this.prisma.$transaction([
      this.prisma.needAWorker.deleteMany({
        where: { id: { in: needAWorkerIds } },
      }),
      this.prisma.notification.deleteMany({
        where: { workRequestId: { in: needAWorkerIds } },
      }),
    ]);

    for (const photo of photos) {
      deleteNeedWorkerRefPhoto(photo.filename);
    }

    for (const needAWorkerId of needAWorkerIds) {
      await this.searchService.removeDocument(
        ES_INDEX.NEED_A_WORKER,
        needAWorkerId,
      );
    }
  }

  async removeProductAds(productAdIds: string[]): Promise<void> {
    if (productAdIds.length === 0) return;

    const where = { productAdId: { in: productAdIds } };
    const [photos, videos] = await Promise.all([
      this.prisma.productPhoto.findMany({ where, select: { filename: true } }),
      this.prisma.productVideo.findMany({ where, select: { filename: true } }),
    ]);

    await this.prisma.$transaction([
      this.prisma.productAd.deleteMany({ where: { id: { in: productAdIds } } }),
      this.prisma.notification.deleteMany({ where }),
    ]);

    for (const photo of photos) {
      deleteProductPhoto(photo.filename);
    }
    for (const video of videos) {
      deleteProductVideo(video.filename);
    }

    for (const productAdId of productAdIds) {
      await this.searchService.removeDocument(
        ES_INDEX.PRODUCT_ADS,
        productAdId,
      );
      await this.clearCachedCounters([`product-ad:views:${productAdId}`]);
    }
  }

  async removeBusinessListings(businessListingIds: string[]): Promise<void> {
    if (businessListingIds.length === 0) return;

    const where = { businessId: { in: businessListingIds } };
    const [coverPhotos, galleryPhotos] = await Promise.all([
      this.prisma.businessCoverPhoto.findMany({
        where,
        select: { filename: true },
      }),
      this.prisma.businessGallery.findMany({
        where,
        select: { filename: true },
      }),
    ]);

    await this.prisma.businessListing.deleteMany({
      where: { id: { in: businessListingIds } },
    });

    for (const photo of coverPhotos) {
      deleteBusinessCoverPhoto(photo.filename);
    }
    for (const photo of galleryPhotos) {
      deleteBusinessGalleryPhoto(photo.filename);
    }

    for (const businessListingId of businessListingIds) {
      await this.searchService.removeDocument(
        ES_INDEX.BUSINESS_LISTINGS,
        businessListingId,
      );
      await this.clearCachedCounters([
        `business-listing:views:${businessListingId}`,
        `business-listing:clicks:${businessListingId}`,
      ]);
    }
  }

  async removeBannerAds(bannerAdIds: string[]): Promise<void> {
    if (bannerAdIds.length === 0) return;

    const photos = await this.prisma.bannerAdPhoto.findMany({
      where: { bannerAdId: { in: bannerAdIds } },
      select: { filename: true },
    });

    await this.prisma.bannerAd.deleteMany({
      where: { id: { in: bannerAdIds } },
    });

    for (const photo of photos) {
      deleteBannerAdPhoto(photo.filename);
    }

    for (const bannerAdId of bannerAdIds) {
      await this.clearCachedCounters([
        `banner-ad:views:${bannerAdId}`,
        `banner-ad:clicks:${bannerAdId}`,
      ]);
    }
  }

  async removeCommunityPosts(postIds: string[]): Promise<void> {
    if (postIds.length === 0) return;

    const where = { postId: { in: postIds } };
    const [photos, videos] = await Promise.all([
      this.prisma.communityPostPhoto.findMany({
        where,
        select: { filename: true },
      }),
      this.prisma.communityPostVideo.findMany({
        where,
        select: { filename: true },
      }),
    ]);

    await this.prisma.$transaction([
      this.prisma.communityPost.deleteMany({ where: { id: { in: postIds } } }),
      this.prisma.notification.deleteMany({ where }),
    ]);

    for (const photo of photos) {
      deleteCommunityPostPhoto(photo.filename);
    }
    for (const video of videos) {
      deleteCommunityPostVideo(video.filename);
    }
  }

  async removeCommunityEvents(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;

    const banners = await this.prisma.communityEventBanner.findMany({
      where: { eventId: { in: eventIds } },
      select: { filename: true },
    });

    await this.prisma.$transaction([
      this.prisma.communityEvent.deleteMany({
        where: { id: { in: eventIds } },
      }),
      this.prisma.notification.deleteMany({
        where: { eventId: { in: eventIds } },
      }),
    ]);

    for (const banner of banners) {
      deleteCommunityEventBanner(banner.filename);
    }
  }

  async removeCommunityGroups(groupIds: string[]): Promise<void> {
    if (groupIds.length === 0) return;

    const [covers, posts, events] = await Promise.all([
      this.prisma.communityGroupCoverPhoto.findMany({
        where: { groupId: { in: groupIds } },
        select: { filename: true },
      }),
      this.prisma.communityPost.findMany({
        where: { groupId: { in: groupIds } },
        select: { id: true },
      }),
      this.prisma.communityEvent.findMany({
        where: { organizerGroupId: { in: groupIds } },
        select: { id: true },
      }),
    ]);

    await this.removeCommunityPosts(posts.map((post) => post.id));
    await this.removeCommunityEvents(events.map((event) => event.id));

    await this.prisma.$transaction([
      this.prisma.communityGroup.deleteMany({
        where: { id: { in: groupIds } },
      }),
      this.prisma.notification.deleteMany({
        where: { groupId: { in: groupIds } },
      }),
    ]);

    for (const cover of covers) {
      deleteCommunityGroupCover(cover.filename);
    }
  }

  private async clearCachedCounters(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.redis
        .del(key)
        .catch((err) =>
          this.logger.warn(`Failed to clear cached counter ${key}`, err),
        );
    }
  }
}
