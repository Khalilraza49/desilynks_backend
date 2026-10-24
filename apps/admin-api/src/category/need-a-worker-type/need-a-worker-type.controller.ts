import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { NeedAWorkerTypeService } from './need-a-worker-type.service';
import { CreateNeedAWorkerTypeDto } from './dto/create-need-a-worker-type.dto';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { GetAdmin } from '../../auth/decorators/get-admin.decorator';

@UseGuards(JwtAuthGuard)
@Controller('need-worker-type')
export class NeedAWorkerTypeController {
  constructor(
    private readonly needAWorkerTypeService: NeedAWorkerTypeService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateNeedAWorkerTypeDto,
    @GetAdmin('id') adminId: string,
  ) {
    return this.needAWorkerTypeService.create(adminId, dto);
  }

  @Get()
  async getAll() {
    return this.needAWorkerTypeService.getAll();
  }

  @Patch(':id/toggle-status')
  async toggleStatus(@Param('id') id: string) {
    return this.needAWorkerTypeService.toggleStatus(id);
  }
}
