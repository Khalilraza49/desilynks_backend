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
  deleteNeedWorkerRefPhoto,
  deleteTempFile,
  MAX_NEED_A_WORKER_REF_IMAGE_SIZE,
  moveFileToNeedWorkerReqRefPhotos,
} from '@libs/common';
import { CreateNeedAWorkerDto } from './dto/create-need-a-worker.dto';
import { UpdateNeedAWorkerDto } from './dto/update-need-a-worker.dto';
import { GetUserNeedAWorkerReqQueryDto } from './dto/get-user-need-a-worker-req-query.dto';
import {
  CategoryStatus,
  NotificationType,
  Prisma,
  WorkerService,
} from '@generated/prisma';
import { ApplyNeedAWorkerDto } from './dto/apply-need-a-worker.dto';
import { GetUserNeedAWorkerApplicationsQueryDto } from './dto/get-user-need-a-worker-applications-query.dto';
import { GetApplicationsOfNeedAWorkerPostQueryDto } from './dto/get-applications-of-need-a-worker-post-query.dto';
import { GetAllNeedAWorkerPostsQueryDto } from './dto/get-all-need-a-worker-posts-query.dto';
import { NotificationQueueService } from '../notification/notification-queue.service';

@Injectable()
export class NeedAWorkerService {
  private readonly logger = new Logger(NeedAWorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    private readonly notificationQueue: NotificationQueueService,
  ) {}

  async createNeedAWorker(
    userId: string,
    dto: CreateNeedAWorkerDto,
    referencePhotos: Express.Multer.File[] = [],
  ) {
    const workerType = await this.prisma.needAWorkerType.findUnique({
      where: {
        id: dto.workerTypeId,
      },
    });

    if (!workerType || workerType.status !== CategoryStatus.ACTIVE) {
      this._cleanupTempFiles(referencePhotos);
      throw new BadRequestException('Invalid worker type');
    }

    for (const refPhoto of referencePhotos) {
      if (refPhoto.size > MAX_NEED_A_WORKER_REF_IMAGE_SIZE) {
        this._cleanupTempFiles(referencePhotos);
        throw new BadRequestException(
          `Reference photo "${refPhoto.originalname}" exceeds the 3MB size limit`,
        );
      }
    }

    const movedRefPhotos: string[] = [];

    try {
      const referencePhotosRecords = referencePhotos.map((refPhoto) => {
        const url = moveFileToNeedWorkerReqRefPhotos(refPhoto.filename);
        movedRefPhotos.push(refPhoto.filename);
        return {
          url,
          filename: refPhoto.filename,
          mimetype: refPhoto.mimetype,
        };
      });

      const needAWorker = await this.prisma.needAWorker.create({
        data: {
          requesterId: userId,
          ...dto,
          referencePhotos: {
            createMany: { data: referencePhotosRecords },
          },
        },
        include: {
          referencePhotos: { select: { id: true, url: true } },
          workerType: { select: { id: true, title: true } },
        },
      });

      await this.searchService.indexDocument(
        ES_INDEX.NEED_A_WORKER,
        needAWorker.id,
        needAWorker,
      );

      const service = this._getWorkerServiceFromTitle(
        needAWorker.workerType.title,
      );

      if (service) {
        await this.notificationQueue.queueFanoutNotification({
          audience: { kind: 'WORKER_SERVICE', service },
          excludeUserIds: [userId],
          notification: {
            type: NotificationType.NEED_A_WORKER_POSTED,
            actorId: userId,
            title: needAWorker.isUrgentRequest
              ? 'Urgent Work Request'
              : 'New Work Request',
            body: `${needAWorker.workerType.title} needed in ${needAWorker.location}.`,
            referenceIds: { workRequestId: needAWorker.id },
          },
        });
      }

      return {
        message: 'Need a worker request posted successfully',
        data: needAWorker,
      };
    } catch (err) {
      if (movedRefPhotos && movedRefPhotos.length > 0) {
        for (const movedRefPhoto of movedRefPhotos) {
          deleteNeedWorkerRefPhoto(movedRefPhoto);
        }
      }

      this._cleanupTempFiles(referencePhotos);

      if (err instanceof BadRequestException) {
        throw err;
      }

      this.logger.error(
        'Failed to create need worker post',
        err instanceof Error ? err.stack : err,
      );
      throw new InternalServerErrorException(
        'Failed to create need worker post',
      );
    }
  }

  async updateNeedAWorkerDetails(
    userId: string,
    needAWorkerId: string,
    dto: UpdateNeedAWorkerDto,
  ) {
    const needAWorker = await this.prisma.needAWorker.findFirst({
      where: {
        id: needAWorkerId,
        requesterId: userId,
      },
    });

    if (!needAWorker) {
      throw new NotFoundException(
        'Need worker post not found or access denied',
      );
    }

    if (needAWorker.workerTypeId !== dto.workerTypeId) {
      const workerType = await this.prisma.needAWorkerType.findUnique({
        where: {
          id: dto.workerTypeId,
        },
      });

      if (!workerType || workerType.status !== CategoryStatus.ACTIVE) {
        throw new BadRequestException('Invalid worker type');
      }
    }

    const updateNeedAWorker = await this.prisma.needAWorker.update({
      where: {
        id: needAWorkerId,
      },
      data: {
        ...dto,
      },
      include: {
        referencePhotos: { select: { id: true, url: true } },
        workerType: { select: { id: true, title: true } },
      },
    });

    await this.searchService.updateDocument(
      ES_INDEX.NEED_A_WORKER,
      needAWorkerId,
      updateNeedAWorker,
    );

    return {
      message: 'Need a worker post updated successfully',
      data: updateNeedAWorker,
    };
  }

  async updateNeedAWorkerRefImages(
    userId: string,
    needAWorkerId: string,
    newPhotoFiles: Express.Multer.File[],
    refPhotoIdsToRemove: string[],
  ) {
    const needAWorker = await this.prisma.needAWorker.findFirst({
      where: { id: needAWorkerId, requesterId: userId },
      include: { referencePhotos: true },
    });

    if (!needAWorker) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new NotFoundException(
        'Need worker post not found or access denied',
      );
    }

    const existingPhotos = needAWorker.referencePhotos;

    const invalidIds = refPhotoIdsToRemove.filter(
      (id) => !existingPhotos.some((p) => p.id === id),
    );
    if (invalidIds.length > 0) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new BadRequestException(
        `The following photo IDs do not belong to this need worker post: ${invalidIds.join(', ')}`,
      );
    }

    const photosToDelete = existingPhotos.filter((p) =>
      refPhotoIdsToRemove.includes(p.id),
    );

    const remainingCount = existingPhotos.length - photosToDelete.length;
    const totalAfterUpdate = remainingCount + newPhotoFiles.length;

    if (totalAfterUpdate > 6) {
      this._cleanupTempFiles(newPhotoFiles);
      throw new BadRequestException(
        `A need worker post can have at most 6 reference photos. ` +
          `After removal you would have ${remainingCount} photo(s); ` +
          `adding ${newPhotoFiles.length} more would exceed the limit`,
      );
    }

    for (const photo of newPhotoFiles) {
      if (photo.size > MAX_NEED_A_WORKER_REF_IMAGE_SIZE) {
        this._cleanupTempFiles(newPhotoFiles);
        throw new BadRequestException(
          `Reference photo "${photo.originalname}" exceeds the 3MB size limit`,
        );
      }
    }

    const movedFilenames: string[] = [];
    try {
      const newPhotoRecords = newPhotoFiles.map((photo) => {
        const url = moveFileToNeedWorkerReqRefPhotos(photo.filename);
        movedFilenames.push(photo.filename);
        return {
          url,
          filename: photo.filename,
          mimetype: photo.mimetype,
          workRequestId: needAWorkerId,
        };
      });

      await this.prisma.$transaction(async (tx) => {
        if (photosToDelete.length > 0) {
          await tx.needAWorkerRefPhoto.deleteMany({
            where: { id: { in: photosToDelete.map((p) => p.id) } },
          });
        }

        if (newPhotoRecords.length > 0) {
          await tx.needAWorkerRefPhoto.createMany({ data: newPhotoRecords });
        }
      });

      for (const photo of photosToDelete) {
        deleteNeedWorkerRefPhoto(photo.filename);
      }

      const updatedNeedAWorker = await this.prisma.needAWorker.findUnique({
        where: { id: needAWorkerId },
        include: {
          referencePhotos: { select: { id: true, url: true } },
          workerType: { select: { id: true, title: true } },
        },
      });

      if (updatedNeedAWorker) {
        await this.searchService.updateDocument(
          ES_INDEX.NEED_A_WORKER,
          needAWorkerId,
          updatedNeedAWorker,
        );
      }

      return {
        message: 'Need worker post reference photos updated successfully',
        data: updatedNeedAWorker,
      };
    } catch (err) {
      for (const filename of movedFilenames) {
        deleteNeedWorkerRefPhoto(filename);
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
      this.logger.error(
        'Failed to update need worker post reference photos',
        err instanceof Error ? err.stack : err,
      );
      throw new InternalServerErrorException(
        'Failed to update need worker post reference photos. Please try again',
      );
    }
  }

  async getUserNeedAWorkerPosts(
    userId: string,
    query: GetUserNeedAWorkerReqQueryDto,
  ) {
    const { page = 1, limit = 10, budgetType } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.NeedAWorkerWhereInput = {
      requesterId: userId,
    };
    if (budgetType) where.budgetType = budgetType;

    const [needAWorkerPosts, count] = await Promise.all([
      this.prisma.needAWorker.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          referencePhotos: { select: { id: true, url: true } },
          workerType: { select: { id: true, title: true } },
        },
      }),
      this.prisma.needAWorker.count({ where }),
    ]);

    return {
      data: needAWorkerPosts,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getAllNeedAWorkerPosts(query: GetAllNeedAWorkerPostsQueryDto) {
    const { page = 1, limit = 10, budgetType, workerTypeId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.NeedAWorkerWhereInput = {};
    if (budgetType) where.budgetType = budgetType;
    if (workerTypeId) where.workerTypeId = workerTypeId;

    const [needAWorkerPosts, count] = await Promise.all([
      this.prisma.needAWorker.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          referencePhotos: { select: { id: true, url: true } },
          workerType: { select: { id: true, title: true } },
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhoto: { select: { url: true } },
            },
          },
        },
      }),
      this.prisma.needAWorker.count({ where }),
    ]);

    return {
      data: needAWorkerPosts,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getNeedAWorkerPostById(needAWorkerId: string) {
    const needAWorker = await this.prisma.needAWorker.findUnique({
      where: { id: needAWorkerId },
      include: {
        referencePhotos: { select: { id: true, url: true } },
        workerType: { select: { id: true, title: true } },
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: { select: { url: true } },
          },
        },
        _count: {
          select: { workerApplications: true },
        },
      },
    });

    if (!needAWorker) {
      throw new NotFoundException('Need worker post not found');
    }

    return {
      message: 'Need worker post fetched successfully',
      data: needAWorker,
    };
  }

  async deleteNeedAWorkerPost(userId: string, needAWorkerId: string) {
    const needAWorker = await this.prisma.needAWorker.findFirst({
      where: {
        id: needAWorkerId,
        requesterId: userId,
      },
      include: { referencePhotos: true },
    });

    if (!needAWorker) {
      throw new NotFoundException(
        'Need worker post not found or access denied',
      );
    }

    await this.prisma.needAWorker.delete({
      where: {
        id: needAWorkerId,
      },
    });

    for (const photo of needAWorker.referencePhotos) {
      deleteNeedWorkerRefPhoto(photo.filename);
    }

    await this.searchService.removeDocument(
      ES_INDEX.NEED_A_WORKER,
      needAWorkerId,
    );

    await this.notificationQueue.queueDeleteNotification({
      referenceIds: { workRequestId: needAWorkerId },
    });

    return {
      message: 'Need worker post deleted successfully',
    };
  }

  async applyOnNeedAWorkerPost(
    user: any,
    needAWorkerId: string,
    dto: ApplyNeedAWorkerDto,
  ) {
    const userId = user.id;
    const needAWorker = await this.prisma.needAWorker.findUnique({
      where: { id: needAWorkerId },
      include: { workerType: { select: { title: true } } },
    });

    if (!needAWorker) {
      throw new NotFoundException('Need worker post not found');
    }

    if (needAWorker.requesterId === userId) {
      throw new BadRequestException('You cannot apply to your own post');
    }

    const alreadyApplied = await this.prisma.needAWorkerApplication.findUnique({
      where: {
        workerId_workRequestId: {
          workerId: userId,
          workRequestId: needAWorkerId,
        },
      },
    });

    if (alreadyApplied) {
      throw new ConflictException('You have already applied on this post');
    }

    const application = await this.prisma.needAWorkerApplication.create({
      data: {
        workerId: userId,
        workRequestId: needAWorkerId,
        ...dto,
      },
    });

    await this.notificationQueue.queueNotification({
      type: NotificationType.WORKER_APPLICATION_RECEIVED,
      recipientId: needAWorker.requesterId,
      actorId: userId,
      title: 'New Application',
      body: `${user.firstName} ${user.lastName} applied for your ${needAWorker.workerType.title} request.`,
      referenceIds: {
        workRequestId: needAWorkerId,
        needAWorkerAppId: application.id,
      },
    });

    return {
      message: 'Applied successfully',
      data: application,
    };
  }

  async getUserNeedAWorkerApplications(
    userId: string,
    query: GetUserNeedAWorkerApplicationsQueryDto,
  ) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.NeedAWorkerApplicationWhereInput = {
      workerId: userId,
    };
    if (status) where.status = status;

    const [applications, count] = await Promise.all([
      this.prisma.needAWorkerApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          workRequest: true,
        },
      }),
      this.prisma.needAWorkerApplication.count({ where }),
    ]);

    return {
      data: applications,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async withdrawNeedAWorkerApplication(user: any, applicationId: string) {
    const userId = user.id;
    const application = await this.prisma.needAWorkerApplication.findUnique({
      where: {
        id: applicationId,
      },
      include: {
        workRequest: {
          select: {
            requesterId: true,
            workerType: { select: { title: true } },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.workerId !== userId) {
      throw new ForbiddenException(
        'You can only withdraw your own application',
      );
    }

    if (application.status !== 'PENDING') {
      throw new BadRequestException(
        'You can only withdraw an application that is in PENDING status',
      );
    }

    const updatedApplication = await this.prisma.needAWorkerApplication.update({
      where: {
        id: applicationId,
      },
      data: {
        status: 'WITHDRAWN',
      },
    });

    await this.notificationQueue.queueNotification({
      type: NotificationType.WORKER_APPLICATION_WITHDRAWN,
      recipientId: application.workRequest.requesterId,
      actorId: userId,
      title: 'Application Withdrawn',
      body: `${user.firstName} ${user.lastName} withdrew their application for your ${application.workRequest.workerType.title} request.`,
      referenceIds: {
        workRequestId: application.workRequestId,
        needAWorkerAppId: applicationId,
      },
    });

    return {
      message: 'Application withdrawn successfully',
      data: updatedApplication,
    };
  }

  async getApplicationsOfNeedAWorkerPost(
    userId: string,
    needAWorkerId: string,
    query: GetApplicationsOfNeedAWorkerPostQueryDto,
  ) {
    const needAWorker = await this.prisma.needAWorker.findUnique({
      where: { id: needAWorkerId },
    });

    if (!needAWorker) {
      throw new NotFoundException('Need worker post not found');
    }

    if (needAWorker.requesterId !== userId) {
      throw new ForbiddenException(
        'You can only view applications for your own posts',
      );
    }

    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.NeedAWorkerApplicationWhereInput = {
      workRequestId: needAWorkerId,
    };
    if (status) where.status = status;

    const [applications, count] = await Promise.all([
      this.prisma.needAWorkerApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          worker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              profilePhoto: {
                select: {
                  url: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.needAWorkerApplication.count({ where }),
    ]);

    return {
      data: applications,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async acceptWorkerApplication(userId: string, applicationId: string) {
    const application = await this.prisma.needAWorkerApplication.findUnique({
      where: { id: applicationId },
      include: {
        workRequest: {
          include: { workerType: { select: { title: true } } },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.workRequest.requesterId !== userId) {
      throw new ForbiddenException(
        'You can only accept applications for your own posts',
      );
    }

    if (application.status !== 'PENDING') {
      throw new BadRequestException('You can only accept PENDING applications');
    }

    const [updatedApplication, pendingApplications] =
      await this.prisma.$transaction(async (tx) => {
        const accepted = await tx.needAWorkerApplication.update({
          where: { id: applicationId },
          data: { status: 'ACCEPTED' },
        });

        const pendingWhere: Prisma.NeedAWorkerApplicationWhereInput = {
          workRequestId: application.workRequestId,
          id: { not: applicationId },
          status: 'PENDING',
        };

        const pending = await tx.needAWorkerApplication.findMany({
          where: pendingWhere,
          select: { id: true, workerId: true },
        });

        await tx.needAWorkerApplication.updateMany({
          where: pendingWhere,
          data: { status: 'REJECTED' },
        });

        return [accepted, pending] as const;
      });

    const workerTypeTitle = application.workRequest.workerType.title;

    await this.notificationQueue.queueNotification({
      type: NotificationType.WORKER_APPLICATION_ACCEPTED,
      recipientId: application.workerId,
      actorId: userId,
      title: 'Application Accepted',
      body: `Your application for the ${workerTypeTitle} request was accepted.`,
      referenceIds: {
        workRequestId: application.workRequestId,
        needAWorkerAppId: applicationId,
      },
    });

    for (const pendingApplication of pendingApplications) {
      await this.notificationQueue.queueNotification({
        type: NotificationType.WORKER_APPLICATION_REJECTED,
        recipientId: pendingApplication.workerId,
        actorId: userId,
        title: 'Application Rejected',
        body: `The ${workerTypeTitle} request you applied for has been filled.`,
        referenceIds: {
          workRequestId: application.workRequestId,
          needAWorkerAppId: pendingApplication.id,
        },
      });
    }

    return {
      message: 'Application accepted successfully',
      data: updatedApplication,
    };
  }

  async rejectWorkerApplication(userId: string, applicationId: string) {
    const application = await this.prisma.needAWorkerApplication.findUnique({
      where: { id: applicationId },
      include: {
        workRequest: {
          include: { workerType: { select: { title: true } } },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.workRequest.requesterId !== userId) {
      throw new ForbiddenException(
        'You can only reject applications for your own posts',
      );
    }

    if (application.status !== 'PENDING') {
      throw new BadRequestException('You can only reject PENDING applications');
    }

    const updatedApplication = await this.prisma.needAWorkerApplication.update({
      where: { id: applicationId },
      data: { status: 'REJECTED' },
    });

    await this.notificationQueue.queueNotification({
      type: NotificationType.WORKER_APPLICATION_REJECTED,
      recipientId: application.workerId,
      actorId: userId,
      title: 'Application Rejected',
      body: `Your application for the ${application.workRequest.workerType.title} request was rejected.`,
      referenceIds: {
        workRequestId: application.workRequestId,
        needAWorkerAppId: applicationId,
      },
    });

    return {
      message: 'Application rejected successfully',
      data: updatedApplication,
    };
  }

  private _cleanupTempFiles(files: Express.Multer.File[]): void {
    for (const file of files) {
      deleteTempFile(file.filename);
    }
  }

  private _getWorkerServiceFromTitle(title: string): WorkerService | null {
    const service = title.trim().toUpperCase().replace(/\s+/g, '_');

    return Object.values(WorkerService).includes(service as WorkerService)
      ? (service as WorkerService)
      : null;
  }
}
