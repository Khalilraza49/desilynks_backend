import { Module } from '@nestjs/common';
import { JobCategoryController } from './job-category/job-category.controller';
import { BusinessCategoryController } from './business-category/business-category.controller';
import { JobCategoryService } from './job-category/job-category.service';
import { BusinessCategoryService } from './business-category/business-category.service';
import { NeedAWorkerTypeController } from './need-a-worker-type/need-a-worker-type.controller';
import { NeedAWorkerTypeService } from './need-a-worker-type/need-a-worker-type.service';
import { PropertyFeatureAmenityController } from './property-feature-amenity/property-feature-amenity.controller';
import { PropertyFeatureAmenityService } from './property-feature-amenity/property-feature-amenity.service';

@Module({
  controllers: [
    JobCategoryController,
    BusinessCategoryController,
    NeedAWorkerTypeController,
    PropertyFeatureAmenityController,
  ],
  providers: [
    JobCategoryService,
    BusinessCategoryService,
    NeedAWorkerTypeService,
    PropertyFeatureAmenityService,
  ],
})
export class CategoryModule {}
