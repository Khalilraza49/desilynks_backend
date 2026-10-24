import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { NeedAWorkerService } from './need-a-worker.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  imageFileFilter,
  MAX_NEED_A_WORKER_REF_IMAGE_SIZE,
  MAX_PHOTO_DIMENSION,
  OptimizeImagePipe,
  tempStorage,
  UPLOAD_THROTTLE,
} from '@libs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CreateNeedAWorkerDto } from './dto/create-need-a-worker.dto';
import { UpdateNeedAWorkerDto } from './dto/update-need-a-worker.dto';
import { UpdateNeedAWorkerRefPhotosDto } from './dto/update-need-a-worker-ref-photos.dto';
import { GetUserNeedAWorkerReqQueryDto } from './dto/get-user-need-a-worker-req-query.dto';
import { ApplyNeedAWorkerDto } from './dto/apply-need-a-worker.dto';
import { GetUserNeedAWorkerApplicationsQueryDto } from './dto/get-user-need-a-worker-applications-query.dto';
import { GetApplicationsOfNeedAWorkerPostQueryDto } from './dto/get-applications-of-need-a-worker-post-query.dto';
import { GetAllNeedAWorkerPostsQueryDto } from './dto/get-all-need-a-worker-posts-query.dto';

@Controller('need-worker')
export class NeedAWorkerController {
  constructor(private readonly needAWorkerService: NeedAWorkerService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FilesInterceptor('reference-photos', 6, {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: MAX_NEED_A_WORKER_REF_IMAGE_SIZE,
      },
    }),
  )
  async createNeedAWorker(
    @GetUser('id') userId: string,
    @Body() dto: CreateNeedAWorkerDto,
    @UploadedFiles(
      new OptimizeImagePipe({ 'reference-photos': MAX_PHOTO_DIMENSION }),
    )
    referencePhotos: Express.Multer.File[],
  ) {
    return this.needAWorkerService.createNeedAWorker(
      userId,
      dto,
      referencePhotos,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateNeedAWorker(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) needAWorkerId: string,
    @Body() dto: UpdateNeedAWorkerDto,
  ) {
    return this.needAWorkerService.updateNeedAWorkerDetails(
      userId,
      needAWorkerId,
      dto,
    );
  }

  @Patch(':id/reference-photos')
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FilesInterceptor('reference-photos', 6, {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: MAX_NEED_A_WORKER_REF_IMAGE_SIZE,
      },
    }),
  )
  async updateNeedWorkerRefImages(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) needAWorkerId: string,
    @Body() dto: UpdateNeedAWorkerRefPhotosDto,
    @UploadedFiles(
      new OptimizeImagePipe({ 'reference-photos': MAX_PHOTO_DIMENSION }),
    )
    referencePhotos: Express.Multer.File[],
  ) {
    const photos = referencePhotos ?? [];
    const removals = dto.refPhotosToRemove ?? [];

    if (photos.length === 0 && removals.length === 0) {
      return { message: 'No changes requested', data: null };
    }

    return this.needAWorkerService.updateNeedAWorkerRefImages(
      userId,
      needAWorkerId,
      photos,
      removals,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getUserNeedAWorkerPosts(
    @GetUser('id') userId: string,
    @Query() query: GetUserNeedAWorkerReqQueryDto,
  ) {
    return this.needAWorkerService.getUserNeedAWorkerPosts(userId, query);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllNeedAWorkerPosts(@Query() query: GetAllNeedAWorkerPostsQueryDto) {
    return this.needAWorkerService.getAllNeedAWorkerPosts(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getNeedAWorkerPostById(
    @Param('id', ParseUUIDPipe) needAWorkerId: string,
  ) {
    return this.needAWorkerService.getNeedAWorkerPostById(needAWorkerId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteNeedAWorkerPost(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) needAWorkerId: string,
  ) {
    return this.needAWorkerService.deleteNeedAWorkerPost(userId, needAWorkerId);
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard)
  async applyOnNeedAWorkerPost(
    @GetUser() user: any,
    @Param('id', ParseUUIDPipe) needAWorkerId: string,
    @Body() dto: ApplyNeedAWorkerDto,
  ) {
    return this.needAWorkerService.applyOnNeedAWorkerPost(
      user,
      needAWorkerId,
      dto,
    );
  }

  @Get('applications/me')
  @UseGuards(JwtAuthGuard)
  async getUserNeedAWorkerApplications(
    @GetUser('id') userId: string,
    @Query() query: GetUserNeedAWorkerApplicationsQueryDto,
  ) {
    return this.needAWorkerService.getUserNeedAWorkerApplications(
      userId,
      query,
    );
  }

  @Patch('application/:id/withdraw')
  @UseGuards(JwtAuthGuard)
  async withdrawNeedAWorkerApplication(
    @GetUser() user: any,
    @Param('id', ParseUUIDPipe) applicationId: string,
  ) {
    return this.needAWorkerService.withdrawNeedAWorkerApplication(
      user,
      applicationId,
    );
  }

  @Get(':id/applications')
  @UseGuards(JwtAuthGuard)
  async getApplicationsOfNeedAWorkerPost(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) needAWorkerId: string,
    @Query() query: GetApplicationsOfNeedAWorkerPostQueryDto,
  ) {
    return this.needAWorkerService.getApplicationsOfNeedAWorkerPost(
      userId,
      needAWorkerId,
      query,
    );
  }

  @Patch('application/:id/accept')
  @UseGuards(JwtAuthGuard)
  async acceptWorkerApplication(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) applicationId: string,
  ) {
    return this.needAWorkerService.acceptWorkerApplication(
      userId,
      applicationId,
    );
  }

  @Patch('application/:id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectWorkerApplication(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) applicationId: string,
  ) {
    return this.needAWorkerService.rejectWorkerApplication(
      userId,
      applicationId,
    );
  }
}
