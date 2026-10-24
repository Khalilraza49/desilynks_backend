import { Controller, Get } from '@nestjs/common';
import { CategoriesAndTypesService } from './categories-and-types.service';

@Controller('categories-and-types')
export class CategoriesAndTypesController {
  constructor(
    private readonly categoriesAndTypesService: CategoriesAndTypesService,
  ) {}

  @Get('business-categories')
  async getBusinessCategories() {
    return this.categoriesAndTypesService.getBusinessCategories();
  }

  @Get('job-categories')
  async getJobCategories() {
    return this.categoriesAndTypesService.getJobCategories();
  }

  @Get('need-worker-types')
  async getNeedAWorkerTypes() {
    return this.categoriesAndTypesService.getNeedAWorkerTypes();
  }

  @Get('property-features-and-amenities')
  async getPropertyFeaturesAndAmenities() {
    return this.categoriesAndTypesService.getPropertyFeaturesAndAmenities();
  }
}
