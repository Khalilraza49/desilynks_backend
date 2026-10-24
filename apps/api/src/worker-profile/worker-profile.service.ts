import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  SearchService,
  ES_INDEX,
  moveFileToWorkerProfilePhotos,
  moveFileToWorkPhotos,
  moveFileToWorkerCertificates,
  deleteWorkerProfilePhoto,
  deleteWorkPhoto,
  deleteWorkerCertificate,
  deleteTempFile,
  MAX_WORKER_PROFILE_PHOTO_SIZE,
  MAX_WORK_PHOTO_SIZE,
  MAX_CERTIFICATE_SIZE,
} from '@libs/common';
import { NotificationType, Prisma } from '@generated/prisma';
import { CreateWorkerProfileDto } from './dto/create-worker-profile.dto';
import { UpdateWorkerProfileDetailsDto } from './dto/update-worker-profile-details.dto';
import { MadeWorkRequestDto } from './dto/made-work-request.dto';
import { GetWorkRequestsQueryDto } from './dto/get-work-requests-query.dto';
import { GetWorkerProfilesQueryDto } from './dto/get-worker-profiles-query.dto';
import { NotificationQueueService } from '../notification/notification-queue.service';
import { BlockService } from '../moderation/block.service';

@Injectable()
export class WorkerProfileService {
  private readonly logger = new Logger(WorkerProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    private readonly notificationQueue: NotificationQueueService,
    private readonly blockService: BlockService,
  ) {}

  async createWorkerProfile(
    userId: string,
    dto: CreateWorkerProfileDto,
    files: {
      profilePhoto?: Express.Multer.File[];
      workPhotos?: Express.Multer.File[];
      certificates?: Express.Multer.File[];
    },
  ) {
    const profilePhotoFile = files.profilePhoto?.[0];
    const workPhotoFiles = files.workPhotos ?? [];
    const certificateFiles = files.certificates ?? [];

    const allTempFiles = [
      ...(profilePhotoFile ? [profilePhotoFile] : []),
      ...workPhotoFiles,
      ...certificateFiles,
    ];

    const existingProfile = await this.prisma.workerProfile.findUnique({
      where: { workerId: userId },
    });

    if (existingProfile) {
      this._cleanupTempFiles(allTempFiles);
      throw new ConflictException('You already have a worker profile');
    }

    if (
      profilePhotoFile &&
      profilePhotoFile.size > MAX_WORKER_PROFILE_PHOTO_SIZE
    ) {
      this._cleanupTempFiles(allTempFiles);
      throw new BadRequestException(
        `Profile photo "${profilePhotoFile.originalname}" exceeds the 2 MB size limit`,
      );
    }

    for (const photo of workPhotoFiles) {
      if (photo.size > MAX_WORK_PHOTO_SIZE) {
        this._cleanupTempFiles(allTempFiles);
        throw new BadRequestException(
          `Work photo "${photo.originalname}" exceeds the 3 MB size limit`,
        );
      }
    }

    for (const cert of certificateFiles) {
      if (cert.size > MAX_CERTIFICATE_SIZE) {
        this._cleanupTempFiles(allTempFiles);
        throw new BadRequestException(
          `Certificate "${cert.originalname}" exceeds the 5 MB size limit`,
        );
      }
    }

    let movedProfilePhotoFilename: string | null = null;
    const movedWorkPhotoFilenames: string[] = [];
    const movedCertificateFilenames: string[] = [];

    try {
      let profilePhotoRecord: {
        url: string;
        filename: string;
        mimetype: string;
      } | null = null;

      if (profilePhotoFile) {
        const url = moveFileToWorkerProfilePhotos(profilePhotoFile.filename);
        movedProfilePhotoFilename = profilePhotoFile.filename;
        profilePhotoRecord = {
          url,
          filename: profilePhotoFile.filename,
          mimetype: profilePhotoFile.mimetype,
        };
      }

      const workPhotoRecords = workPhotoFiles.map((photo) => {
        const url = moveFileToWorkPhotos(photo.filename);
        movedWorkPhotoFilenames.push(photo.filename);
        return {
          url,
          filename: photo.filename,
          mimetype: photo.mimetype,
        };
      });

      const certificateRecords = certificateFiles.map((cert) => {
        const url = moveFileToWorkerCertificates(cert.filename);
        movedCertificateFilenames.push(cert.filename);
        return {
          url,
          filename: cert.filename,
          mimetype: cert.mimetype,
        };
      });

      const workerProfile = await this.prisma.workerProfile.create({
        data: {
          workerId: userId,
          service: dto.service,
          experienceInYears: dto.experienceInYears,
          hourlyRate: dto.hourlyRate,
          dailyRate: dto.dailyRate,
          languagesSpoken: dto.languagesSpoken,
          isAvailableToday: dto.isAvailableToday,
          ownVehicle: dto.ownVehicle,
          ownTools: dto.ownTools,
          areaCovered: dto.areaCovered,
          about: dto.about,
          ...(profilePhotoRecord && {
            profilePhoto: { create: profilePhotoRecord },
          }),
          ...(workPhotoRecords.length > 0 && {
            workPhotos: { createMany: { data: workPhotoRecords } },
          }),
          ...(certificateRecords.length > 0 && {
            certificates: { createMany: { data: certificateRecords } },
          }),
        },
        include: {
          profilePhoto: { select: { id: true, url: true } },
          workPhotos: { select: { id: true, url: true } },
          certificates: { select: { id: true, url: true } },
        },
      });

      await this.searchService.indexDocument(
        ES_INDEX.WORKER_PROFILES,
        workerProfile.id,
        workerProfile,
      );

      return {
        message: 'Worker profile created successfully',
        data: workerProfile,
      };
    } catch (err) {
      if (movedProfilePhotoFilename) {
        deleteWorkerProfilePhoto(movedProfilePhotoFilename);
      }
      for (const filename of movedWorkPhotoFilenames) {
        deleteWorkPhoto(filename);
      }
      for (const filename of movedCertificateFilenames) {
        deleteWorkerCertificate(filename);
      }

      if (profilePhotoFile && !movedProfilePhotoFilename) {
        deleteTempFile(profilePhotoFile.filename);
      }
      for (const photo of workPhotoFiles) {
        if (!movedWorkPhotoFilenames.includes(photo.filename)) {
          deleteTempFile(photo.filename);
        }
      }
      for (const cert of certificateFiles) {
        if (!movedCertificateFilenames.includes(cert.filename)) {
          deleteTempFile(cert.filename);
        }
      }

      if (
        err instanceof BadRequestException ||
        err instanceof ConflictException
      ) {
        throw err;
      }

      this.logger.error('Failed to create worker profile', err);
      throw new InternalServerErrorException(
        'Failed to create worker profile. Please try again',
      );
    }
  }

  async updateWorkerProfileDetails(
    userId: string,
    profileId: string,
    dto: UpdateWorkerProfileDetailsDto,
    newPhotoFile?: Express.Multer.File,
  ) {
    const workerProfile = await this.prisma.workerProfile.findFirst({
      where: {
        workerId: userId,
        id: profileId,
      },
      include: {
        profilePhoto: true,
      },
    });

    if (!workerProfile) {
      if (newPhotoFile) deleteTempFile(newPhotoFile.filename);
      throw new NotFoundException('Worker profile not found or access denied');
    }

    if (newPhotoFile && newPhotoFile.size > MAX_WORKER_PROFILE_PHOTO_SIZE) {
      deleteTempFile(newPhotoFile.filename);
      throw new BadRequestException(
        `Profile photo "${newPhotoFile.originalname}" exceeds the 2 MB size limit`,
      );
    }

    const existingPhoto = workerProfile.profilePhoto;
    let movedPhotoFilename: string | null = null;

    try {
      let newPhotoRecord: {
        url: string;
        filename: string;
        mimetype: string;
        workerProfileId: string;
      } | null = null;

      if (newPhotoFile) {
        const url = moveFileToWorkerProfilePhotos(newPhotoFile.filename);
        movedPhotoFilename = newPhotoFile.filename;
        newPhotoRecord = {
          url,
          filename: newPhotoFile.filename,
          mimetype: newPhotoFile.mimetype,
          workerProfileId: profileId,
        };
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.workerProfile.update({
          where: { id: profileId },
          data: { ...dto },
        });

        if (newPhotoRecord) {
          if (existingPhoto) {
            await tx.workerProfilePhoto.delete({
              where: { id: existingPhoto.id },
            });
          }
          await tx.workerProfilePhoto.create({
            data: newPhotoRecord,
          });
        }
      });

      if (newPhotoRecord && existingPhoto) {
        deleteWorkerProfilePhoto(existingPhoto.filename);
      }

      const updatedProfile = await this.prisma.workerProfile.findUnique({
        where: { id: profileId },
        include: {
          profilePhoto: { select: { id: true, url: true } },
          workPhotos: { select: { id: true, url: true } },
          certificates: { select: { id: true, url: true } },
        },
      });

      if (updatedProfile) {
        await this.searchService.updateDocument(
          ES_INDEX.WORKER_PROFILES,
          profileId,
          updatedProfile,
        );
      }

      return {
        message: 'Worker profile updated successfully',
        data: updatedProfile,
      };
    } catch (err) {
      if (movedPhotoFilename) {
        deleteWorkerProfilePhoto(movedPhotoFilename);
      } else if (newPhotoFile) {
        deleteTempFile(newPhotoFile.filename);
      }

      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      this.logger.error('Failed to update worker profile', err);
      throw new InternalServerErrorException(
        'Failed to update worker profile. Please try again',
      );
    }
  }

  async updateWorkerWorkPhotos(
    userId: string,
    profileId: string,
    newPhotoFiles: Express.Multer.File[],
    photoIdsToRemove: string[],
  ) {
    const workerProfile = await this.prisma.workerProfile.findFirst({
      where: { id: profileId, workerId: userId },
      include: { workPhotos: true },
    });

    if (!workerProfile) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new NotFoundException('Worker profile not found or access denied');
    }

    const existingPhotos = workerProfile.workPhotos;

    const invalidIds = photoIdsToRemove.filter(
      (id) => !existingPhotos.some((p) => p.id === id),
    );
    if (invalidIds.length > 0) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new BadRequestException(
        `The following photo IDs do not belong to this worker profile: ${invalidIds.join(', ')}`,
      );
    }

    const photosToDelete = existingPhotos.filter((p) =>
      photoIdsToRemove.includes(p.id),
    );

    const remainingCount = existingPhotos.length - photosToDelete.length;
    const totalAfterUpdate = remainingCount + newPhotoFiles.length;

    if (totalAfterUpdate > 6) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new BadRequestException(
        `A worker profile can have at most 6 work photos. ` +
          `After removal you would have ${remainingCount} photo(s); ` +
          `adding ${newPhotoFiles.length} more would exceed the limit`,
      );
    }

    for (const photo of newPhotoFiles) {
      if (photo.size > MAX_WORK_PHOTO_SIZE) {
        this._cleanupTempFiles(newPhotoFiles);
        throw new BadRequestException(
          `Work photo "${photo.originalname}" exceeds the 3 MB size limit`,
        );
      }
    }

    const movedFilenames: string[] = [];
    try {
      const newPhotoRecords = newPhotoFiles.map((photo) => {
        const url = moveFileToWorkPhotos(photo.filename);
        movedFilenames.push(photo.filename);
        return {
          url,
          filename: photo.filename,
          mimetype: photo.mimetype,
          workerProfileId: profileId,
        };
      });

      await this.prisma.$transaction(async (tx) => {
        if (photosToDelete.length > 0) {
          await tx.workPhoto.deleteMany({
            where: { id: { in: photosToDelete.map((p) => p.id) } },
          });
        }

        if (newPhotoRecords.length > 0) {
          await tx.workPhoto.createMany({ data: newPhotoRecords });
        }
      });

      for (const photo of photosToDelete) {
        deleteWorkPhoto(photo.filename);
      }

      const updatedProfile = await this.prisma.workerProfile.findUnique({
        where: { id: profileId },
        include: {
          profilePhoto: { select: { id: true, url: true } },
          workPhotos: { select: { id: true, url: true } },
          certificates: { select: { id: true, url: true } },
        },
      });

      if (updatedProfile) {
        await this.searchService.updateDocument(
          ES_INDEX.WORKER_PROFILES,
          profileId,
          updatedProfile,
        );
      }

      return {
        message: 'Worker work photos updated successfully',
        data: updatedProfile,
      };
    } catch (err) {
      for (const filename of movedFilenames) {
        deleteWorkPhoto(filename);
      }

      for (const photo of newPhotoFiles) {
        if (!movedFilenames.includes(photo.filename)) {
          deleteTempFile(photo.filename);
        }
      }

      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      this.logger.error('Failed to update worker work photos', err);
      throw new InternalServerErrorException(
        'Failed to update worker work photos. Please try again',
      );
    }
  }

  async updateWorkerCertificates(
    userId: string,
    profileId: string,
    newCertificateFiles: Express.Multer.File[],
    certificateIdsToRemove: string[],
  ) {
    const workerProfile = await this.prisma.workerProfile.findFirst({
      where: { id: profileId, workerId: userId },
      include: { certificates: true },
    });

    if (!workerProfile) {
      this._cleanupTempFiles(newCertificateFiles);
      throw new NotFoundException('Worker profile not found or access denied');
    }

    const existingCertificates = workerProfile.certificates;

    const invalidIds = certificateIdsToRemove.filter(
      (id) => !existingCertificates.some((c) => c.id === id),
    );
    if (invalidIds.length > 0) {
      this._cleanupTempFiles(newCertificateFiles);
      throw new BadRequestException(
        `The following certificate IDs do not belong to this worker profile: ${invalidIds.join(', ')}`,
      );
    }

    const certificatesToDelete = existingCertificates.filter((c) =>
      certificateIdsToRemove.includes(c.id),
    );

    const remainingCount =
      existingCertificates.length - certificatesToDelete.length;
    const totalAfterUpdate = remainingCount + newCertificateFiles.length;

    if (totalAfterUpdate > 5) {
      this._cleanupTempFiles(newCertificateFiles);
      throw new BadRequestException(
        `A worker profile can have at most 5 certificates. ` +
          `After removal you would have ${remainingCount} certificate(s); ` +
          `adding ${newCertificateFiles.length} more would exceed the limit`,
      );
    }

    for (const cert of newCertificateFiles) {
      if (cert.size > MAX_CERTIFICATE_SIZE) {
        this._cleanupTempFiles(newCertificateFiles);
        throw new BadRequestException(
          `Certificate "${cert.originalname}" exceeds the 5 MB size limit`,
        );
      }
    }

    const movedFilenames: string[] = [];
    try {
      const newCertificateRecords = newCertificateFiles.map((cert) => {
        const url = moveFileToWorkerCertificates(cert.filename);
        movedFilenames.push(cert.filename);
        return {
          url,
          filename: cert.filename,
          mimetype: cert.mimetype,
          workerProfileId: profileId,
        };
      });

      await this.prisma.$transaction(async (tx) => {
        if (certificatesToDelete.length > 0) {
          await tx.workCertificate.deleteMany({
            where: { id: { in: certificatesToDelete.map((c) => c.id) } },
          });
        }

        if (newCertificateRecords.length > 0) {
          await tx.workCertificate.createMany({ data: newCertificateRecords });
        }
      });

      for (const cert of certificatesToDelete) {
        deleteWorkerCertificate(cert.filename);
      }

      const updatedProfile = await this.prisma.workerProfile.findUnique({
        where: { id: profileId },
        include: {
          profilePhoto: { select: { id: true, url: true } },
          workPhotos: { select: { id: true, url: true } },
          certificates: { select: { id: true, url: true } },
        },
      });

      if (updatedProfile) {
        await this.searchService.updateDocument(
          ES_INDEX.WORKER_PROFILES,
          profileId,
          updatedProfile,
        );
      }

      return {
        message: 'Worker certificates updated successfully',
        data: updatedProfile,
      };
    } catch (err) {
      for (const filename of movedFilenames) {
        deleteWorkerCertificate(filename);
      }

      for (const cert of newCertificateFiles) {
        if (!movedFilenames.includes(cert.filename)) {
          deleteTempFile(cert.filename);
        }
      }

      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      this.logger.error('Failed to update worker certificates', err);
      throw new InternalServerErrorException(
        'Failed to update worker certificates. Please try again',
      );
    }
  }

  async toggleTodayAvailability(userId: string, workerProfileId: string) {
    const workerProfile = await this.prisma.workerProfile.findFirst({
      where: {
        id: workerProfileId,
        workerId: userId,
      },
    });

    if (!workerProfile) {
      throw new NotFoundException('Worker profile not found or access denied');
    }

    const updatedProfile = await this.prisma.workerProfile.update({
      where: {
        id: workerProfileId,
      },
      data: {
        isAvailableToday: !workerProfile.isAvailableToday,
      },
      select: {
        isAvailableToday: true,
      },
    });

    await this.searchService.updateDocument(
      ES_INDEX.WORKER_PROFILES,
      workerProfileId,
      {
        isAvailableToday: updatedProfile.isAvailableToday,
      },
    );

    return {
      message: `Availability ${updatedProfile.isAvailableToday ? 'enabled' : 'disabled'} successfully`,
      data: {
        isAvailableToday: updatedProfile.isAvailableToday,
      },
    };
  }

  async getUserWorkerProfile(userId: string) {
    const workerProfile = await this.prisma.workerProfile.findUnique({
      where: {
        workerId: userId,
      },
      include: {
        worker: {
          select: {
            firstName: true,
            lastName: true,
            profilePhoto: { select: { url: true } },
          },
        },
        profilePhoto: { select: { id: true, url: true } },
        workPhotos: { select: { id: true, url: true } },
        certificates: { select: { id: true, url: true } },
        workApplications: {
          select: {
            id: true,
            service: true,
            description: true,
            location: true,
            budget: true,
            type: true,
            schedule: true,
            status: true,
            createdAt: true,
            requester: {
              select: {
                firstName: true,
                lastName: true,
                profilePhoto: { select: { url: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!workerProfile) {
      throw new NotFoundException('Worker profile not found or does not exist');
    }

    const requestCounts = {
      pending: workerProfile.workApplications.filter(
        (r) => r.status === 'PENDING',
      ).length,
      accepted: workerProfile.workApplications.filter(
        (r) => r.status === 'ACCEPTED',
      ).length,
      rejected: workerProfile.workApplications.filter(
        (r) => r.status === 'REJECTED',
      ).length,
      total: workerProfile.workApplications.length,
    };

    return {
      data: {
        ...workerProfile,
        requestCounts,
      },
    };
  }

  async getWorkerProfileById(workerProfileId: string) {
    const workerProfile = await this.prisma.workerProfile.findUnique({
      where: {
        id: workerProfileId,
      },
      include: {
        worker: {
          select: {
            firstName: true,
            lastName: true,
            profilePhoto: { select: { url: true } },
          },
        },
        profilePhoto: { select: { id: true, url: true } },
        workPhotos: { select: { id: true, url: true } },
        certificates: { select: { id: true, url: true } },
      },
    });

    if (!workerProfile) {
      throw new NotFoundException('Worker profile not found');
    }

    const { workerId, ...publicProfile } = workerProfile;

    return {
      data: publicProfile,
    };
  }

  async madeWorkRequest(
    user: any,
    workerProfileId: string,
    dto: MadeWorkRequestDto,
  ) {
    const userId = user.id;
    const workerProfile = await this.prisma.workerProfile.findUnique({
      where: { id: workerProfileId },
    });

    if (!workerProfile) {
      throw new NotFoundException('Worker profile not found');
    }

    if (workerProfile.workerId === userId) {
      throw new ForbiddenException(
        'You cannot send a work request to your own profile',
      );
    }

    await this.blockService.assertNotBlocked(userId, workerProfile.workerId);

    if (workerProfile.service !== dto.service) {
      throw new BadRequestException(
        `This worker offers ${workerProfile.service} service, not ${dto.service}`,
      );
    }

    if (dto.schedule <= new Date()) {
      throw new BadRequestException('Schedule date must be in the future');
    }

    const existingPendingRequest = await this.prisma.workRequest.findFirst({
      where: {
        requesterId: userId,
        workerProfileId,
        status: 'PENDING',
      },
    });

    if (existingPendingRequest) {
      throw new ConflictException(
        'You already have a pending work request for this worker',
      );
    }

    try {
      const workRequest = await this.prisma.workRequest.create({
        data: {
          requesterId: userId,
          workerProfileId,
          service: dto.service,
          description: dto.description,
          location: dto.location,
          budget: dto.budget,
          type: dto.type,
          schedule: dto.schedule,
        },
        select: {
          id: true,
          service: true,
          description: true,
          location: true,
          budget: true,
          type: true,
          schedule: true,
          status: true,
          createdAt: true,
        },
      });

      await this.notificationQueue.queueNotification({
        type: NotificationType.WORK_REQUEST_RECEIVED,
        recipientId: workerProfile.workerId,
        actorId: userId,
        title: 'New Work Request',
        body: `${user.firstName} ${user.lastName} sent you a work request.`,
        referenceIds: {
          workerProfileId,
          workRequestId: workRequest.id,
        },
      });

      return {
        message: 'Work request sent successfully',
        data: workRequest,
      };
    } catch (err) {
      this.logger.error('Failed to create work request', err);
      throw new InternalServerErrorException(
        'Failed to send work request. Please try again',
      );
    }
  }

  async getWorkApplications(
    userId: string,
    workerProfileId: string,
    query: GetWorkRequestsQueryDto,
  ) {
    const workerProfile = await this.prisma.workerProfile.findFirst({
      where: { id: workerProfileId, workerId: userId },
    });

    if (!workerProfile) {
      throw new NotFoundException('Worker profile not found or access denied');
    }

    const { page = 1, limit = 10, type, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkRequestWhereInput = {
      workerProfileId,
    };

    if (type) where.type = type;
    if (status) where.status = status;

    const [workRequests, count] = await Promise.all([
      this.prisma.workRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          service: true,
          description: true,
          location: true,
          budget: true,
          type: true,
          schedule: true,
          status: true,
          createdAt: true,
          requester: {
            select: {
              firstName: true,
              lastName: true,
              profilePhoto: { select: { url: true } },
            },
          },
        },
      }),
      this.prisma.workRequest.count({ where }),
    ]);

    return {
      data: workRequests,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getMyWorkRequests(userId: string, query: GetWorkRequestsQueryDto) {
    const { page = 1, limit = 10, type, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkRequestWhereInput = {
      requesterId: userId,
    };

    if (type) where.type = type;
    if (status) where.status = status;

    const [workRequests, count] = await Promise.all([
      this.prisma.workRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          service: true,
          description: true,
          location: true,
          budget: true,
          type: true,
          schedule: true,
          status: true,
          createdAt: true,
          workerProfile: {
            select: {
              id: true,
              service: true,
              hourlyRate: true,
              dailyRate: true,
              worker: {
                select: {
                  firstName: true,
                  lastName: true,
                  profilePhoto: { select: { url: true } },
                },
              },
              profilePhoto: { select: { url: true } },
            },
          },
        },
      }),
      this.prisma.workRequest.count({ where }),
    ]);

    return {
      data: workRequests,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async acceptWorkRequest(user: any, workRequestId: string) {
    const userId = user.id;
    const workRequest = await this.prisma.workRequest.findUnique({
      where: { id: workRequestId },
      include: { workerProfile: true },
    });

    if (!workRequest) {
      throw new NotFoundException('Work request not found');
    }

    if (workRequest.workerProfile.workerId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to accept this work request',
      );
    }

    if (workRequest.status !== 'PENDING') {
      throw new BadRequestException(
        `Work request is already ${workRequest.status.toLowerCase()}`,
      );
    }

    const updated = await this.prisma.workRequest.update({
      where: { id: workRequestId },
      data: { status: 'ACCEPTED' },
      select: {
        id: true,
        service: true,
        description: true,
        location: true,
        budget: true,
        type: true,
        schedule: true,
        status: true,
        createdAt: true,
        requester: {
          select: {
            firstName: true,
            lastName: true,
            profilePhoto: { select: { url: true } },
          },
        },
      },
    });

    await this.notificationQueue.queueNotification({
      type: NotificationType.WORK_REQUEST_ACCEPTED,
      recipientId: workRequest.requesterId,
      actorId: userId,
      title: 'Work Request Accepted',
      body: `${user.firstName} ${user.lastName} accepted your work request.`,
      referenceIds: {
        workerProfileId: workRequest.workerProfileId,
        workRequestId,
      },
    });

    return {
      message: 'Work request accepted successfully',
      data: updated,
    };
  }

  async rejectWorkRequest(user: any, workRequestId: string) {
    const userId = user.id;
    const workRequest = await this.prisma.workRequest.findUnique({
      where: { id: workRequestId },
      include: { workerProfile: true },
    });

    if (!workRequest) {
      throw new NotFoundException('Work request not found');
    }

    if (workRequest.workerProfile.workerId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to reject this work request',
      );
    }

    if (workRequest.status !== 'PENDING') {
      throw new BadRequestException(
        `Work request is already ${workRequest.status.toLowerCase()}`,
      );
    }

    const updated = await this.prisma.workRequest.update({
      where: { id: workRequestId },
      data: { status: 'REJECTED' },
      select: {
        id: true,
        service: true,
        description: true,
        location: true,
        budget: true,
        type: true,
        schedule: true,
        status: true,
        createdAt: true,
        requester: {
          select: {
            firstName: true,
            lastName: true,
            profilePhoto: { select: { url: true } },
          },
        },
      },
    });

    await this.notificationQueue.queueNotification({
      type: NotificationType.WORK_REQUEST_REJECTED,
      recipientId: workRequest.requesterId,
      actorId: userId,
      title: 'Work Request Rejected',
      body: `${user.firstName} ${user.lastName} rejected your work request.`,
      referenceIds: {
        workerProfileId: workRequest.workerProfileId,
        workRequestId,
      },
    });

    return {
      message: 'Work request rejected successfully',
      data: updated,
    };
  }

  async withdrawWorkRequest(user: any, workRequestId: string) {
    const userId = user.id;
    const workRequest = await this.prisma.workRequest.findUnique({
      where: { id: workRequestId },
      include: {
        workerProfile: {
          select: {
            id: true,
            workerId: true,
            service: true,
            hourlyRate: true,
            dailyRate: true,
            worker: {
              select: {
                firstName: true,
                lastName: true,
                profilePhoto: { select: { url: true } },
              },
            },
            profilePhoto: { select: { url: true } },
          },
        },
      },
    });

    if (!workRequest) {
      throw new NotFoundException('Work request not found');
    }

    if (workRequest.requesterId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to withdraw this work request',
      );
    }

    if (workRequest.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot withdraw work request because it is already ${workRequest.status.toLowerCase()}`,
      );
    }

    const updated = await this.prisma.workRequest.update({
      where: { id: workRequestId },
      data: { status: 'WITHDRAWN' },
      select: {
        id: true,
        service: true,
        description: true,
        location: true,
        budget: true,
        type: true,
        schedule: true,
        status: true,
        createdAt: true,
        workerProfile: {
          select: {
            id: true,
            service: true,
            hourlyRate: true,
            dailyRate: true,
            worker: {
              select: {
                firstName: true,
                lastName: true,
                profilePhoto: { select: { url: true } },
              },
            },
            profilePhoto: { select: { url: true } },
          },
        },
      },
    });

    await this.notificationQueue.queueNotification({
      type: NotificationType.WORK_REQUEST_WITHDRAWN,
      recipientId: workRequest.workerProfile.workerId,
      actorId: userId,
      title: 'Work Request Withdrawn',
      body: `${user.firstName} ${user.lastName} withdrew their work request.`,
      referenceIds: {
        workerProfileId: workRequest.workerProfileId,
        workRequestId,
      },
    });

    return {
      message: 'Work request withdrawn successfully',
      data: updated,
    };
  }

  async bulkAcceptWorkRequests(user: any, workRequestIds: string[]) {
    const userId = user.id;
    const workRequests = await this.prisma.workRequest.findMany({
      where: { id: { in: workRequestIds } },
      include: { workerProfile: true },
    });

    if (workRequests.length !== workRequestIds.length) {
      const foundIds = workRequests.map((r) => r.id);
      const missingIds = workRequestIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Work requests not found: ${missingIds.join(', ')}`,
      );
    }

    const unauthorized = workRequests.filter(
      (r) => r.workerProfile.workerId !== userId,
    );
    if (unauthorized.length > 0) {
      throw new ForbiddenException(
        'You are not authorized to accept one or more of these work requests',
      );
    }

    const pendingWorkRequests = workRequests.filter(
      (r) => r.status === 'PENDING',
    );
    const pendingIds = pendingWorkRequests.map((r) => r.id);

    const skippedCount = workRequests.length - pendingIds.length;

    const result = await this.prisma.workRequest.updateMany({
      where: { id: { in: pendingIds } },
      data: { status: 'ACCEPTED' },
    });

    for (const pendingWorkRequest of pendingWorkRequests) {
      await this.notificationQueue.queueNotification({
        type: NotificationType.WORK_REQUEST_ACCEPTED,
        recipientId: pendingWorkRequest.requesterId,
        actorId: userId,
        title: 'Work Request Accepted',
        body: `${user.firstName} ${user.lastName} accepted your work request.`,
        referenceIds: {
          workerProfileId: pendingWorkRequest.workerProfileId,
          workRequestId: pendingWorkRequest.id,
        },
      });
    }

    return {
      message: 'Bulk accept completed',
      data: {
        accepted: result.count,
        skipped: skippedCount,
        total: workRequestIds.length,
      },
    };
  }

  async bulkRejectWorkRequests(user: any, workRequestIds: string[]) {
    const userId = user.id;
    const workRequests = await this.prisma.workRequest.findMany({
      where: { id: { in: workRequestIds } },
      include: { workerProfile: true },
    });

    if (workRequests.length !== workRequestIds.length) {
      const foundIds = workRequests.map((r) => r.id);
      const missingIds = workRequestIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Work requests not found: ${missingIds.join(', ')}`,
      );
    }

    const unauthorized = workRequests.filter(
      (r) => r.workerProfile.workerId !== userId,
    );
    if (unauthorized.length > 0) {
      throw new ForbiddenException(
        'You are not authorized to reject one or more of these work requests',
      );
    }

    const pendingWorkRequests = workRequests.filter(
      (r) => r.status === 'PENDING',
    );
    const pendingIds = pendingWorkRequests.map((r) => r.id);

    const skippedCount = workRequests.length - pendingIds.length;

    const result = await this.prisma.workRequest.updateMany({
      where: { id: { in: pendingIds } },
      data: { status: 'REJECTED' },
    });

    for (const pendingWorkRequest of pendingWorkRequests) {
      await this.notificationQueue.queueNotification({
        type: NotificationType.WORK_REQUEST_REJECTED,
        recipientId: pendingWorkRequest.requesterId,
        actorId: userId,
        title: 'Work Request Rejected',
        body: `${user.firstName} ${user.lastName} rejected your work request.`,
        referenceIds: {
          workerProfileId: pendingWorkRequest.workerProfileId,
          workRequestId: pendingWorkRequest.id,
        },
      });
    }

    return {
      message: 'Bulk reject completed',
      data: {
        rejected: result.count,
        skipped: skippedCount,
        total: workRequestIds.length,
      },
    };
  }

  async getAllWorkerProfiles(query: GetWorkerProfilesQueryDto) {
    const { page = 1, limit = 10, service } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkerProfileWhereInput = {};
    if (service) {
      where.service = service;
    }

    const [workerProfiles, count] = await Promise.all([
      this.prisma.workerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          worker: {
            select: {
              firstName: true,
              lastName: true,
              profilePhoto: { select: { url: true } },
            },
          },
          profilePhoto: { select: { id: true, url: true } },
          workPhotos: { select: { id: true, url: true } },
          certificates: { select: { id: true, url: true } },
        },
      }),
      this.prisma.workerProfile.count({ where }),
    ]);

    const publicProfiles = workerProfiles.map(
      ({ workerId, ...profile }) => profile,
    );

    return {
      data: publicProfiles,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async deleteWorkerProfile(userId: string, profileId: string) {
    const workerProfile = await this.prisma.workerProfile.findUnique({
      where: { id: profileId },
      include: {
        profilePhoto: true,
        workPhotos: true,
        certificates: true,
      },
    });

    if (!workerProfile) {
      throw new NotFoundException('Worker profile not found');
    }

    if (workerProfile.workerId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to delete this worker profile',
      );
    }

    try {
      await this.prisma.workerProfile.delete({
        where: { id: profileId },
      });
      await this.searchService.removeDocument(
        ES_INDEX.WORKER_PROFILES,
        profileId,
      );

      await this.notificationQueue.queueDeleteNotification({
        referenceIds: { workerProfileId: profileId },
      });
    } catch (err) {
      this.logger.error('Failed to delete worker profile from database', err);
      throw new InternalServerErrorException(
        'Failed to delete worker profile. Please try again',
      );
    }

    if (workerProfile.profilePhoto) {
      deleteWorkerProfilePhoto(workerProfile.profilePhoto.filename);
    }
    for (const photo of workerProfile.workPhotos) {
      deleteWorkPhoto(photo.filename);
    }
    for (const cert of workerProfile.certificates) {
      deleteWorkerCertificate(cert.filename);
    }

    return {
      message: 'Worker profile deleted successfully',
    };
  }

  private _cleanupTempFiles(files: Express.Multer.File[]): void {
    for (const file of files) {
      deleteTempFile(file.filename);
    }
  }
}
