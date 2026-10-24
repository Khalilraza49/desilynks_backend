import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { BusinessCategoryService } from './business-category.service';
import { CreateBusinessCategoryDto } from './dto/create-business-category.dto';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { GetAdmin } from '../../auth/decorators/get-admin.decorator';

@UseGuards(JwtAuthGuard)
@Controller('business-category')
export class BusinessCategoryController {
  constructor(
    private readonly businessCategoryService: BusinessCategoryService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateBusinessCategoryDto,
    @GetAdmin('id') adminId: string,
  ) {
    return this.businessCategoryService.create(adminId, dto);
  }

  @Get()
  async getAll() {
    return this.businessCategoryService.getAll();
  }

  @Patch(':id/toggle-status')
  async toggleStatus(@Param('id') id: string) {
    return this.businessCategoryService.toggleStatus(id);
  }
}