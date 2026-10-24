import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { REPORT_THROTTLE } from '@libs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @Throttle(REPORT_THROTTLE)
  @UseGuards(JwtAuthGuard)
  async createReport(
    @GetUser('id') userId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportService.createReport(userId, dto);
  }
}
