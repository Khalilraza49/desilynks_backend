import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { GetAdmin } from '../auth/decorators/get-admin.decorator';
import { SupportService } from './support.service';
import { GetSupportFormsQueryDto } from './dto/get-support-forms-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('support-forms')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  async getSupportForms(@Query() query: GetSupportFormsQueryDto) {
    return this.supportService.getSupportForms(query);
  }

  @Get(':id')
  async getSupportFormById(@Param('id', ParseUUIDPipe) id: string) {
    return this.supportService.getSupportFormById(id);
  }

  @Patch(':id/resolve')
  async resolveSupportForm(
    @GetAdmin('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supportService.resolveSupportForm(adminId, id);
  }
}
