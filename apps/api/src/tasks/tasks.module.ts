import { Module } from '@nestjs/common';
import { PropertyViewSyncTask } from './property-view-sync.task';
import { ProductAdViewSyncTask } from './product-ad-view-sync.task';
import { BusinessListingViewSyncTask } from './business-listing-view-sync.task';
import { TempCleanupTask } from './temp-cleanup.task';
import { BannerAdExpiryTask } from './banner-ad-expiry.task';
import { BannerAdViewSyncTask } from './banner-ad-view-sync.task';

@Module({
  providers: [
    PropertyViewSyncTask,
    ProductAdViewSyncTask,
    BusinessListingViewSyncTask,
    TempCleanupTask,
    BannerAdExpiryTask,
    BannerAdViewSyncTask,
  ],
})
export class TasksModule {}
