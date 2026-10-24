import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JobCategoryService } from './job-category.service';
import { CreateJobCategoryDto } from './dto/create-job-category.dto';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { GetAdmin } from '../../auth/decorators/get-admin.decorator';

@UseGuards(JwtAuthGuard)
@Controller('job-category')
export class JobCategoryController {
  constructor(private readonly jobCategoryService: JobCategoryService) {}

  @Post()
  async create(
    @Body() dto: CreateJobCategoryDto,
    @GetAdmin('id') adminId: string,
  ) {
    return this.jobCategoryService.create(adminId, dto);
  }

  @Get()
  async getAll() {
    return this.jobCategoryService.getAll();
  }

  @Patch(':id/toggle-status')
  async toggleStatus(@Param('id') id: string) {
    return this.jobCategoryService.toggleStatus(id);
  }
}
