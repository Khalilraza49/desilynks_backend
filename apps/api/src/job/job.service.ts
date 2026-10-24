import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
  SearchService,
  ES_INDEX,
  moveFileToJobPosters,
  deleteJobPoster,
  deleteTempFile,
  MAX_JOB_POSTER_SIZE,
} from '@libs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { GetUserJobsQueryDto } from './dto/get-user-jobs-query.dto';
import { GetAllJobsQueryDto } from './dto/get-all-jobs-query.dto';
import { ApplyJobDto } from './dto/apply-job.dto';
import {
  Prisma,
  JobApplicationStatus,
  CategoryStatus,
  NotificationType,
} from '@generated/prisma';
import { GetUserJobApplicationsQueryDto } from './dto/get-user-job-applications-query.dto';
import { GetApplicationsOfJobQueryDto } from './dto/get-applications-of-job-query.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { BulkUpdateApplicationStatusDto } from './dto/bulk-update-application-status.dto';
import { NotificationQueueService } from '../notification/notification-queue.service';

@Injectable()
export class JobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    private readonly notificationQueue: NotificationQueueService,
  ) {}

  async createJob(
    userId: string,
    dto: CreateJobDto,
    posterFile: Express.Multer.File,
  ) {
    const category = await this.prisma.jobCategory.findUnique({
      where: {
        id: dto.categoryId,
      },
    });

    if (!category || category.status !== CategoryStatus.ACTIVE) {
      deleteTempFile(posterFile.filename);
      throw new BadRequestException('Invalid job category');
    }
    if (posterFile.size > MAX_JOB_POSTER_SIZE) {
      deleteTempFile(posterFile.filename);
      throw new BadRequestException(
        'Job poster image exceeds the 3 MB size limit',
      );
    }

    let movedPosterFilename: string | null = null;

    try {
      const posterUrl = moveFileToJobPosters(posterFile.filename);
      movedPosterFilename = posterFile.filename;

      const job = await this.prisma.job.create({
        data: {
          ...dto,
          employerId: userId,
          poster: {
            create: {
              url: posterUrl,
              filename: posterFile.filename,
              mimetype: posterFile.mimetype,
            },
          },
        },
        include: {
          poster: { select: { id: true, url: true } },
          category: { select: { id: true, title: true } },
        },
      });

      await this.searchService.indexDocument(ES_INDEX.JOBS, job.id, job);

      return {
        message: 'Job posted successfully',
        data: job,
      };
    } catch (err) {
      if (movedPosterFilename) {
        deleteJobPoster(movedPosterFilename);
      } else {
        deleteTempFile(posterFile.filename);
      }

      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException(
        'Failed to create job. Please try again',
      );
    }
  }

  async getUserJobs(userId: string, query: GetUserJobsQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [jobs, count] = await Promise.all([
      this.prisma.job.findMany({
        where: { employerId: userId },
        include: {
          poster: { select: { id: true, url: true } },
          category: { select: { id: true, title: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.job.count({
        where: { employerId: userId },
      }),
    ]);

    return {
      data: jobs,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getAllJobs(query: GetAllJobsQueryDto, userId?: string) {
    const {
      page = 1,
      limit = 10,
      categoryId,
      type,
      experience,
      workMode,
      salary,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = {};

    if (categoryId) where.categoryId = categoryId;
    if (type) where.type = type;
    if (experience) where.experience = experience;
    if (workMode) where.workMode = workMode;

    if (salary !== undefined) {
      where.salary = { gte: salary };
    }

    const [jobs, count] = await Promise.all([
      this.prisma.job.findMany({
        where,
        include: {
          poster: { select: { id: true, url: true } },
          category: { select: { id: true, title: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.job.count({ where }),
    ]);

    let jobsWithApplicationStatus = jobs as any[];

    if (userId) {
      const jobIds = jobs.map((job) => job.id);

      const applications = await this.prisma.jobApplications.findMany({
        where: {
          applicantId: userId,
          jobId: { in: jobIds },
        },
        select: { jobId: true },
      });

      const appliedJobIds = new Set(applications.map((app) => app.jobId));

      jobsWithApplicationStatus = jobs.map((job) => ({
        ...job,
        isApplied: appliedJobIds.has(job.id),
      }));
    }

    return {
      data: jobsWithApplicationStatus,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getJobById(jobId: string, userId?: string) {
    const job = await this.prisma.job.findUnique({
      where: {
        id: jobId,
      },
      include: {
        poster: { select: { id: true, url: true } },
        category: { select: { id: true, title: true } },
        employer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: {
              select: {
                url: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    let isApplied = false;

    if (userId) {
      const application = await this.prisma.jobApplications.findUnique({
        where: {
          jobId_applicantId: {
            jobId,
            applicantId: userId,
          },
        },
        select: { id: true },
      });

      isApplied = !!application;
    }

    return {
      data: {
        ...job,
        isApplied,
      },
    };
  }

  async updateJob(userId: string, jobId: string, dto: UpdateJobDto) {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        employerId: userId,
      },
    });

    if (!job) {
      throw new NotFoundException(
        'Job not found or you do not have access to it',
      );
    }

    if (job.categoryId !== dto.categoryId) {
      const category = await this.prisma.jobCategory.findUnique({
        where: {
          id: dto.categoryId,
        },
      });

      if (!category || category.status !== CategoryStatus.ACTIVE) {
        throw new BadRequestException('Invalid job category');
      }
    }

    const updatedJob = await this.prisma.job.update({
      where: {
        id: jobId,
      },
      data: {
        ...dto,
      },
      include: {
        poster: { select: { id: true, url: true } },
        category: { select: { id: true, title: true } },
      },
    });

    await this.searchService.updateDocument(ES_INDEX.JOBS, jobId, updatedJob);

    return {
      message: 'Job updated successfully',
      data: updatedJob,
    };
  }

  async updateJobPoster(
    userId: string,
    jobId: string,
    posterFile: Express.Multer.File,
  ) {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        employerId: userId,
      },
      include: {
        poster: true,
      },
    });

    if (!job) {
      deleteTempFile(posterFile.filename);
      throw new NotFoundException(
        'Job not found or you do not have access to it',
      );
    }

    if (posterFile.size > MAX_JOB_POSTER_SIZE) {
      deleteTempFile(posterFile.filename);
      throw new BadRequestException(
        'Job poster image exceeds the 3 MB size limit',
      );
    }

    let movedPosterFilename: string | null = null;
    const oldPosterFilename = job.poster?.filename ?? null;

    try {
      const posterUrl = moveFileToJobPosters(posterFile.filename);
      movedPosterFilename = posterFile.filename;

      const posterRecord = {
        url: posterUrl,
        filename: posterFile.filename,
        mimetype: posterFile.mimetype,
      };

      const updatedJob = await this.prisma.job.update({
        where: {
          id: jobId,
        },
        data: {
          poster: {
            upsert: {
              create: posterRecord,
              update: posterRecord,
            },
          },
        },
        include: {
          poster: { select: { id: true, url: true } },
          category: { select: { id: true, title: true } },
        },
      });

      if (oldPosterFilename) {
        deleteJobPoster(oldPosterFilename);
      }

      await this.searchService.updateDocument(ES_INDEX.JOBS, jobId, updatedJob);

      return {
        message: 'Job poster updated successfully',
        data: updatedJob,
      };
    } catch (err) {
      if (movedPosterFilename) {
        deleteJobPoster(movedPosterFilename);
      } else {
        deleteTempFile(posterFile.filename);
      }

      if (err instanceof BadRequestException) throw err;
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'Failed to update job poster. Please try again',
      );
    }
  }

  async markJobAsClosed(userId: string, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.employerId !== userId) {
      throw new ForbiddenException(
        'You can only change the status of jobs you have posted',
      );
    }

    if (job.status !== 'OPEN') {
      throw new BadRequestException(
        'Only jobs with an Open status can be closed',
      );
    }

    await this.prisma.job.update({
      where: {
        id: jobId,
      },
      data: {
        status: 'CLOSED',
      },
    });

    await this.searchService.updateDocument(ES_INDEX.JOBS, jobId, {
      status: 'CLOSED',
    });

    return {
      message: 'Job marked as closed successfully',
    };
  }

  async markJobAsArchived(userId: string, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.employerId !== userId) {
      throw new ForbiddenException(
        'You can only change the status of jobs you have posted',
      );
    }

    if (job.status !== 'OPEN') {
      throw new BadRequestException(
        'Only jobs with an Open status can be archived',
      );
    }

    await this.prisma.job.update({
      where: {
        id: jobId,
      },
      data: {
        status: 'ARCHIVED',
      },
    });

    await this.searchService.updateDocument(ES_INDEX.JOBS, jobId, {
      status: 'ARCHIVED',
    });

    return {
      message: 'Job archived successfully',
    };
  }

  async deleteJob(userId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        employerId: userId,
      },
      include: {
        poster: { select: { filename: true } },
      },
    });

    if (!job) {
      throw new NotFoundException(
        'Job not found or you do not have access to it',
      );
    }

    const posterFilename = job.poster?.filename ?? null;

    await this.prisma.job.delete({
      where: {
        id: jobId,
      },
    });

    if (posterFilename) {
      deleteJobPoster(posterFilename);
    }

    await this.searchService.removeDocument(ES_INDEX.JOBS, jobId);

    return {
      message: 'Job deleted successfully',
    };
  }

  async applyForJob(user: any, jobId: string, dto: ApplyJobDto) {
    const userId = user.id;
    const job = await this.prisma.job.findUnique({
      where: {
        id: jobId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        employerId: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== 'OPEN') {
      throw new BadRequestException(
        'This job is no longer accepting applications',
      );
    }

    if (job.employerId === userId) {
      throw new BadRequestException('You cannot apply to your own job posting');
    }

    const existingApplication = await this.prisma.jobApplications.findUnique({
      where: {
        jobId_applicantId: {
          jobId,
          applicantId: userId,
        },
      },
    });

    if (existingApplication) {
      throw new ConflictException('You have already applied for this job');
    }

    try {
      const application = await this.prisma.jobApplications.create({
        data: {
          jobId,
          applicantId: userId,
          ...dto,
        },
      });

      await this.notificationQueue.queueNotification({
        type: NotificationType.JOB_APPLICATION_RECEIVED,
        recipientId: job.employerId,
        actorId: userId,
        title: 'New Job Application',
        body: `${user.firstName} ${user.lastName} applied for ${job.title}.`,
        referenceIds: { jobApplicationId: application.id },
        data: { jobId },
      });

      return {
        message: 'Successfully applied for the job',
        data: application,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('You have already applied for this job');
      }

      throw err;
    }
  }

  async getUserJobApplications(
    userId: string,
    query: GetUserJobApplicationsQueryDto,
  ) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.JobApplicationsWhereInput = {
      applicantId: userId,
    };

    if (status) where.status = status;

    const [jobs, count] = await Promise.all([
      this.prisma.jobApplications.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              companyName: true,
              location: true,
              type: true,
              workMode: true,
              salary: true,
              salaryPeriod: true,
              poster: { select: { id: true, url: true } },
              category: { select: { id: true, title: true } },
            },
          },
        },
      }),
      this.prisma.jobApplications.count({ where }),
    ]);

    return {
      data: jobs,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getJobApplicationById(userId: string, jobApplicationId: string) {
    const jobApplication = await this.prisma.jobApplications.findUnique({
      where: {
        id: jobApplicationId,
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            companyName: true,
            location: true,
            type: true,
            workMode: true,
            salary: true,
            salaryPeriod: true,
            employerId: true,
            poster: { select: { id: true, url: true } },
            category: { select: { id: true, title: true } },
          },
        },
        applicant: {
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
    });

    if (!jobApplication) {
      throw new NotFoundException('Job application not found');
    }

    if (
      jobApplication.applicant.id !== userId &&
      jobApplication.job.employerId !== userId
    ) {
      throw new ForbiddenException(
        'You are not authorized to view this application',
      );
    }

    return {
      data: jobApplication,
    };
  }

  async withDrawJobApplication(user: any, jobApplicationId: string) {
    const userId = user.id;
    const jobApplication = await this.prisma.jobApplications.findUnique({
      where: {
        id: jobApplicationId,
      },
      include: {
        job: {
          select: { employerId: true, title: true },
        },
      },
    });

    if (!jobApplication) {
      throw new NotFoundException('Job application not found');
    }

    if (jobApplication.applicantId !== userId) {
      throw new ForbiddenException(
        'You can only withdraw your own application',
      );
    }

    if (jobApplication.status === 'WITHDRAWN') {
      throw new BadRequestException(
        'This application has already been withdrawn',
      );
    }

    const updatedApplication = await this.prisma.jobApplications.update({
      where: {
        id: jobApplicationId,
      },
      data: {
        status: 'WITHDRAWN',
      },
    });

    await this.notificationQueue.queueNotification({
      type: NotificationType.JOB_APPLICATION_WITHDRAWN,
      recipientId: jobApplication.job.employerId,
      actorId: userId,
      title: 'Application Withdrawn',
      body: `${user.firstName} ${user.lastName} withdrew their application for ${jobApplication.job.title}.`,
      referenceIds: { jobApplicationId },
      data: { jobId: jobApplication.jobId },
    });

    return {
      message: 'Application withdrawn successfully',
      data: updatedApplication,
    };
  }

  async updateApplicationStatus(
    userId: string,
    applicationId: string,
    dto: UpdateApplicationStatusDto,
  ) {
    const application = await this.prisma.jobApplications.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          select: { employerId: true, title: true },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Job application not found');
    }

    if (application.job.employerId !== userId) {
      throw new ForbiddenException(
        'You can only update the status of applications for your own jobs',
      );
    }

    if (application.status === 'WITHDRAWN') {
      throw new BadRequestException(
        'Cannot update the status of a withdrawn application',
      );
    }

    const updatedApplication = await this.prisma.jobApplications.update({
      where: { id: applicationId },
      data: { status: dto.status },
    });

    if (application.status !== dto.status) {
      await this.notificationQueue.queueNotification({
        type: NotificationType.JOB_APPLICATION_STATUS_UPDATED,
        recipientId: application.applicantId,
        actorId: userId,
        title: 'Application Status Updated',
        body: this.getApplicationStatusMessage(
          dto.status,
          application.job.title,
        ),
        referenceIds: { jobApplicationId: applicationId },
        data: { jobId: application.jobId, status: dto.status },
      });
    }

    return {
      message: 'Application status updated successfully',
      data: updatedApplication,
    };
  }

  async bulkUpdateApplicationStatus(
    userId: string,
    dto: BulkUpdateApplicationStatusDto,
  ) {
    const applications = await this.prisma.jobApplications.findMany({
      where: {
        id: { in: dto.applicationIds },
      },
      include: {
        job: {
          select: { employerId: true, title: true },
        },
      },
    });

    if (applications.length === 0) {
      throw new NotFoundException('No matching applications were found');
    }

    const notFound = dto.applicationIds.filter(
      (id) => !applications.find((app) => app.id === id),
    );

    if (notFound.length > 0) {
      throw new NotFoundException(
        `The following applications were not found: ${notFound.join(', ')}`,
      );
    }

    const unauthorized = applications.filter(
      (app) => app.job.employerId !== userId,
    );

    if (unauthorized.length > 0) {
      throw new ForbiddenException(
        'You can only update the status of applications for your own jobs',
      );
    }

    const withdrawn = applications.filter((app) => app.status === 'WITHDRAWN');

    if (withdrawn.length > 0) {
      throw new BadRequestException(
        `${withdrawn.length} application(s) have already been withdrawn and cannot be updated`,
      );
    }

    const result = await this.prisma.jobApplications.updateMany({
      where: {
        id: { in: dto.applicationIds },
      },
      data: { status: dto.status },
    });

    const changedApplications = applications.filter(
      (app) => app.status !== dto.status,
    );

    for (const app of changedApplications) {
      await this.notificationQueue.queueNotification({
        type: NotificationType.JOB_APPLICATION_STATUS_UPDATED,
        recipientId: app.applicantId,
        actorId: userId,
        title: 'Application Status Updated',
        body: this.getApplicationStatusMessage(dto.status, app.job.title),
        referenceIds: { jobApplicationId: app.id },
        data: { jobId: app.jobId, status: dto.status },
      });
    }

    return {
      message: `${result.count} application(s) updated successfully`,
      data: {
        updatedCount: result.count,
        status: dto.status,
      },
    };
  }

  async getEmployerApplicationStats(userId: string) {
    const statusCounts = await this.prisma.jobApplications.groupBy({
      by: ['status'],
      where: {
        job: {
          employerId: userId,
        },
      },
      _count: {
        status: true,
      },
    });

    const stats: Record<string, number> = {};
    let total = 0;

    for (const value of Object.values(JobApplicationStatus)) {
      stats[value] = 0;
    }

    for (const entry of statusCounts) {
      stats[entry.status] = entry._count.status;
      total += entry._count.status;
    }

    return {
      message: 'Employer application stats fetched successfully',
      data: {
        ...stats,
        total,
      },
    };
  }

  async getApplicantApplicationStats(userId: string) {
    const statusCounts = await this.prisma.jobApplications.groupBy({
      by: ['status'],
      where: {
        applicantId: userId,
      },
      _count: {
        status: true,
      },
    });

    const stats: Record<string, number> = {};
    let total = 0;

    for (const value of Object.values(JobApplicationStatus)) {
      stats[value] = 0;
    }

    for (const entry of statusCounts) {
      stats[entry.status] = entry._count.status;
      total += entry._count.status;
    }

    return {
      message: 'Applicant application stats fetched successfully',
      data: {
        ...stats,
        total,
      },
    };
  }

  async getApplicationsOfJobs(
    userId: string,
    jobId: string,
    query: GetApplicationsOfJobQueryDto,
  ) {
    const job = await this.prisma.job.findUnique({
      where: {
        id: jobId,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.employerId !== userId) {
      throw new ForbiddenException(
        'You can only view applications for your own jobs',
      );
    }

    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.JobApplicationsWhereInput = {
      jobId,
    };

    if (status) where.status = status;

    const [jobApplications, count] = await Promise.all([
      this.prisma.jobApplications.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          applicant: {
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
      this.prisma.jobApplications.count({ where }),
    ]);

    return {
      data: jobApplications,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  private getApplicationStatusMessage(
    status: JobApplicationStatus,
    jobTitle: string,
  ): string {
    const messages: Record<string, string> = {
      [JobApplicationStatus.REVIEWING]: `Your application for ${jobTitle} is being reviewed.`,
      [JobApplicationStatus.SHORTLISTED]: `You have been shortlisted for ${jobTitle}.`,
      [JobApplicationStatus.INTERVIEW]: `You have been invited to interview for ${jobTitle}.`,
      [JobApplicationStatus.OFFERED]: `You have received an offer for ${jobTitle}.`,
      [JobApplicationStatus.REJECTED]: `Your application for ${jobTitle} was not selected.`,
    };

    return (
      messages[status] ??
      `The status of your application for ${jobTitle} was updated.`
    );
  }
}
