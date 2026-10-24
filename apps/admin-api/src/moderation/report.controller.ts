import {
  Body,
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
import { ReportService } from './report.service';
import { GetReportsQueryDto } from './dto/get-reports-query.dto';
import { ActionReportDto } from './dto/action-report.dto';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  async getReports(@Query() query: GetReportsQueryDto) {
    return this.reportService.getReports(query);
  }

  @Get(':id')
  async getReportById(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportService.getReportById(id);
  }

  @Patch(':id/dismiss')
  async dismissReport(
    @GetAdmin('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportService.dismissReport(adminId, id);
  }

  @Patch(':id/action')
  async actionReport(
    @GetAdmin('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActionReportDto,
  ) {
    return this.reportService.actionReport(adminId, id, dto);
  }
}
