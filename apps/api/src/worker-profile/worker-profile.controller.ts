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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { WorkerProfileService } from './worker-profile.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CreateWorkerProfileDto } from './dto/create-worker-profile.dto';
import { UpdateWorkerProfileDetailsDto } from './dto/update-worker-profile-details.dto';
import { UpdateWorkerWorkPhotosDto } from './dto/update-worker-work-photos.dto';
import { UpdateWorkerCertificatesDto } from './dto/update-worker-certificates.dto';
import { MadeWorkRequestDto } from './dto/made-work-request.dto';
import { GetWorkRequestsQueryDto } from './dto/get-work-requests-query.dto';
import { GetWorkerProfilesQueryDto } from './dto/get-worker-profiles-query.dto';
import { BulkWorkRequestActionDto } from './dto/bulk-work-request-action.dto';
import {
  tempStorage,
  workerProfileFileFilter,
  imageFileFilter,
  MAX_CERTIFICATE_SIZE,
  MAX_WORKER_PROFILE_PHOTO_SIZE,
  MAX_WORK_PHOTO_SIZE,
  MAX_AVATAR_DIMENSION,
  MAX_PHOTO_DIMENSION,
  MAX_BANNER_DIMENSION,
  OptimizeImagePipe,
  UPLOAD_THROTTLE,
} from '@libs/common';

@Controller('worker-profile')
export class WorkerProfileController {
  constructor(private readonly workerProfileService: WorkerProfileService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profilePhoto', maxCount: 1 },
        { name: 'workPhotos', maxCount: 6 },
        { name: 'certificates', maxCount: 5 },
      ],
      {
        storage: tempStorage,
        fileFilter: workerProfileFileFilter,
        limits: {
          fileSize: MAX_CERTIFICATE_SIZE,
        },
      },
    ),
  )
  async createWorkerProfile(
    @Body() dto: CreateWorkerProfileDto,
    @UploadedFiles(
      new OptimizeImagePipe({
        profilePhoto: MAX_AVATAR_DIMENSION,
        workPhotos: MAX_PHOTO_DIMENSION,
        certificates: MAX_BANNER_DIMENSION,
      }),
    )
    files: {
      profilePhoto?: Express.Multer.File[];
      workPhotos?: Express.Multer.File[];
      certificates?: Express.Multer.File[];
    },
    @GetUser('id') userId: string,
  ) {
    if (!files?.profilePhoto || files.profilePhoto.length === 0) {
      throw new BadRequestException('Profile photo is required');
    }

    return this.workerProfileService.createWorkerProfile(userId, dto, files);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      storage: tempStorage,
      fileFilter: workerProfileFileFilter,
      limits: { fileSize: MAX_WORKER_PROFILE_PHOTO_SIZE },
    }),
  )
  async updateWorkerProfileDetails(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) profileId: string,
    @Body() dto: UpdateWorkerProfileDetailsDto,
    @UploadedFile(new OptimizeImagePipe({ profilePhoto: MAX_AVATAR_DIMENSION }))
    profilePhoto?: Express.Multer.File,
  ) {
    return this.workerProfileService.updateWorkerProfileDetails(
      userId,
      profileId,
      dto,
      profilePhoto,
    );
  }

  @Patch(':id/work-photos')
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FilesInterceptor('workPhotos', 6, {
      storage: tempStorage,
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_WORK_PHOTO_SIZE },
    }),
  )
  async updateWorkerWorkPhotos(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) profileId: string,
    @UploadedFiles(new OptimizeImagePipe({ workPhotos: MAX_PHOTO_DIMENSION }))
    newPhotos: Express.Multer.File[],
    @Body() dto: UpdateWorkerWorkPhotosDto,
  ) {
    const photos = newPhotos ?? [];
    const removals = dto.photosToRemove ?? [];

    if (photos.length === 0 && removals.length === 0) {
      return { message: 'No changes requested', data: null };
    }

    return this.workerProfileService.updateWorkerWorkPhotos(
      userId,
      profileId,
      photos,
      removals,
    );
  }

  @Patch(':id/certificates')
  @UseGuards(JwtAuthGuard)
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(
    FilesInterceptor('certificates', 5, {
      storage: tempStorage,
      fileFilter: workerProfileFileFilter,
      limits: { fileSize: MAX_CERTIFICATE_SIZE },
    }),
  )
  async updateWorkerCertificates(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) profileId: string,
    @UploadedFiles(
      new OptimizeImagePipe({ certificates: MAX_BANNER_DIMENSION }),
    )
    newCertificates: Express.Multer.File[],
    @Body() dto: UpdateWorkerCertificatesDto,
  ) {
    const certs = newCertificates ?? [];
    const removals = dto.certificatesToRemove ?? [];

    if (certs.length === 0 && removals.length === 0) {
      return { message: 'No changes requested', data: null };
    }

    return this.workerProfileService.updateWorkerCertificates(
      userId,
      profileId,
      certs,
      removals,
    );
  }

  @Patch(':id/availability')
  @UseGuards(JwtAuthGuard)
  async toggleTodayAvailability(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) profileId: string,
  ) {
    return this.workerProfileService.toggleTodayAvailability(userId, profileId);
  }

  @Post(':id/work-request')
  @UseGuards(JwtAuthGuard)
  async madeWorkRequest(
    @GetUser() user: any,
    @Param('id', ParseUUIDPipe) workerProfileId: string,
    @Body() dto: MadeWorkRequestDto,
  ) {
    return this.workerProfileService.madeWorkRequest(
      user,
      workerProfileId,
      dto,
    );
  }

  @Get(':id/work-applications')
  @UseGuards(JwtAuthGuard)
  async getWorkApplications(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) workerProfileId: string,
    @Query() query: GetWorkRequestsQueryDto,
  ) {
    return this.workerProfileService.getWorkApplications(
      userId,
      workerProfileId,
      query,
    );
  }

  @Get('me/requests')
  @UseGuards(JwtAuthGuard)
  async getMyWorkRequests(
    @GetUser('id') userId: string,
    @Query() query: GetWorkRequestsQueryDto,
  ) {
    return this.workerProfileService.getMyWorkRequests(userId, query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getUserWorkerProfile(@GetUser('id') userId: string) {
    return this.workerProfileService.getUserWorkerProfile(userId);
  }

  @Patch('work-application/:id/accept')
  @UseGuards(JwtAuthGuard)
  async acceptWorkRequest(
    @GetUser() user: any,
    @Param('id', ParseUUIDPipe) workRequestId: string,
  ) {
    return this.workerProfileService.acceptWorkRequest(user, workRequestId);
  }

  @Patch('work-application/:id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectWorkRequest(
    @GetUser() user: any,
    @Param('id', ParseUUIDPipe) workRequestId: string,
  ) {
    return this.workerProfileService.rejectWorkRequest(user, workRequestId);
  }

  @Patch('work-applications/bulk-accept')
  @UseGuards(JwtAuthGuard)
  async bulkAcceptWorkRequests(
    @GetUser() user: any,
    @Body() dto: BulkWorkRequestActionDto,
  ) {
    return this.workerProfileService.bulkAcceptWorkRequests(user, dto.ids);
  }

  @Patch('work-applications/bulk-reject')
  @UseGuards(JwtAuthGuard)
  async bulkRejectWorkRequests(
    @GetUser() user: any,
    @Body() dto: BulkWorkRequestActionDto,
  ) {
    return this.workerProfileService.bulkRejectWorkRequests(user, dto.ids);
  }

  @Patch('me/requests/:id/withdraw')
  @UseGuards(JwtAuthGuard)
  async withdrawWorkRequest(
    @GetUser() user: any,
    @Param('id', ParseUUIDPipe) workRequestId: string,
  ) {
    return this.workerProfileService.withdrawWorkRequest(user, workRequestId);
  }

  @Get()
  async getAllWorkerProfiles(@Query() query: GetWorkerProfilesQueryDto) {
    return this.workerProfileService.getAllWorkerProfiles(query);
  }

  @Get(':id')
  async getWorkerProfileById(
    @Param('id', ParseUUIDPipe) workerProfileId: string,
  ) {
    return this.workerProfileService.getWorkerProfileById(workerProfileId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteWorkerProfile(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) profileId: string,
  ) {
    return this.workerProfileService.deleteWorkerProfile(userId, profileId);
  }
}
