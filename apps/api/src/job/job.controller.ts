import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JobService } from './job.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CreateJobDto } from './dto/create-job.dto';
import { GetUserJobsQueryDto } from './dto/get-user-jobs-query.dto';
import { GetAllJobsQueryDto } from './dto/get-all-jobs-query.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { ApplyJobDto } from './dto/apply-job.dto';
import { GetUserJobApplicationsQueryDto } from './dto/get-user-job-applications-query.dto';
import { GetApplicationsOfJobQueryDto } from './dto/get-applications-of-job-query.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { BulkUpdateApplicationStatusDto } from './dto/bulk-update-application-status.dto';
import {
  tempStorage,
  imageFileFilter,
  MAX_JOB_POSTER_SIZE,
  MAX_BANNER_DIMENSION,
  OptimizeImagePipe,
  UPLOAD_THROTTLE,
} from '@libs/common';

@Controller('job')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('poster', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_JOB_POSTER_SIZE },
    }),
  )
  async createJob(
    @GetUser('id') userId: string,
    @Body() dto: CreateJobDto,
    @UploadedFile(new OptimizeImagePipe({ poster: MAX_BANNER_DIMENSION }))
    poster: Express.Multer.File,
  ) {
    if (!poster) {
      throw new BadRequestException('Job poster image is required');
    }

    return this.jobService.createJob(userId, dto, poster);
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  async getUserJobs(
    @GetUser('id') userId: string,
    @Query() query: GetUserJobsQueryDto,
  ) {
    return this.jobService.getUserJobs(userId, query);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getAllJobs(
    @GetUser('id') userId: string | undefined,
    @Query() query: GetAllJobsQueryDto,
  ) {
    return this.jobService.getAllJobs(query, userId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getJobById(
    @GetUser('id') userId: string | undefined,
    @Param('id', ParseUUIDPipe) jobId: string,
  ) {
    return this.jobService.getJobById(jobId, userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateJob(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) jobId: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobService.updateJob(userId, jobId, dto);
  }

  @Patch(':id/poster')
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('poster', {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_JOB_POSTER_SIZE },
    }),
  )
  async updateJobPoster(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) jobId: string,
    @UploadedFile(new OptimizeImagePipe({ poster: MAX_BANNER_DIMENSION }))
    poster: Express.Multer.File,
  ) {
    if (!poster) {
      throw new BadRequestException('Job poster image is required');
    }

    return this.jobService.updateJobPoster(userId, jobId, poster);
  }

  @Patch(':id/mark-closed')
  @UseGuards(JwtAuthGuard)
  async markJobAsClosed(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) jobId: string,
  ) {
    return this.jobService.markJobAsClosed(userId, jobId);
  }

  @Patch(':id/mark-archived')
  @UseGuards(JwtAuthGuard)
  async markJobAsArchived(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) jobId: string,
  ) {
    return this.jobService.markJobAsArchived(userId, jobId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteJob(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) jobId: string,
  ) {
    return this.jobService.deleteJob(userId, jobId);
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard)
  async applyForJob(
    @GetUser() user: any,
    @Param('id', ParseUUIDPipe) jobId: string,
    @Body() dto: ApplyJobDto,
  ) {
    return this.jobService.applyForJob(user, jobId, dto);
  }

  @Get('applications/me')
  @UseGuards(JwtAuthGuard)
  async getUserJobApplications(
    @GetUser('id') userId: string,
    @Query() query: GetUserJobApplicationsQueryDto,
  ) {
    return this.jobService.getUserJobApplications(userId, query);
  }

  @Get('application/:id')
  @UseGuards(JwtAuthGuard)
  async getJobApplicationById(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) jobApplicationId: string,
  ) {
    return this.jobService.getJobApplicationById(userId, jobApplicationId);
  }

  @Patch('application/:id/withdraw')
  @UseGuards(JwtAuthGuard)
  async withDrawJobApplication(
    @GetUser() user: any,
    @Param('id', ParseUUIDPipe) jobApplicationId: string,
  ) {
    return this.jobService.withDrawJobApplication(user, jobApplicationId);
  }

  @Patch('application/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateApplicationStatus(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) applicationId: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.jobService.updateApplicationStatus(userId, applicationId, dto);
  }

  @Patch('applications/bulk-status')
  @UseGuards(JwtAuthGuard)
  async bulkUpdateApplicationStatus(
    @GetUser('id') userId: string,
    @Body() dto: BulkUpdateApplicationStatusDto,
  ) {
    return this.jobService.bulkUpdateApplicationStatus(userId, dto);
  }

  @Get('applications/stats/employer')
  @UseGuards(JwtAuthGuard)
  async getEmployerApplicationStats(@GetUser('id') userId: string) {
    return this.jobService.getEmployerApplicationStats(userId);
  }

  @Get('applications/stats/me')
  @UseGuards(JwtAuthGuard)
  async getApplicantApplicationStats(@GetUser('id') userId: string) {
    return this.jobService.getApplicantApplicationStats(userId);
  }

  @Get(':id/applications')
  @UseGuards(JwtAuthGuard)
  async getApplicationsOfJob(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) jobId: string,
    @Query() query: GetApplicationsOfJobQueryDto,
  ) {
    return this.jobService.getApplicationsOfJobs(userId, jobId, query);
  }
}
