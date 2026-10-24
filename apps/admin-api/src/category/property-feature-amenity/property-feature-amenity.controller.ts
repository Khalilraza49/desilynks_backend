import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PropertyFeatureAmenityService } from './property-feature-amenity.service';
import { CreatePropertyFeatureAmenityDto } from './dto/create-property-feature-amenity.dto';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { GetAdmin } from '../../auth/decorators/get-admin.decorator';

@UseGuards(JwtAuthGuard)
@Controller('property-feature-amenity')
export class PropertyFeatureAmenityController {
  constructor(
    private readonly propertyFeatureAmenityService: PropertyFeatureAmenityService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreatePropertyFeatureAmenityDto,
    @GetAdmin('id') adminId: string,
  ) {
    return this.propertyFeatureAmenityService.create(adminId, dto);
  }

  @Get()
  async getAll() {
    return this.propertyFeatureAmenityService.getAll();
  }

  @Patch(':id/toggle-status')
  async toggleStatus(@Param('id') id: string) {
    return this.propertyFeatureAmenityService.toggleStatus(id);
  }
}
