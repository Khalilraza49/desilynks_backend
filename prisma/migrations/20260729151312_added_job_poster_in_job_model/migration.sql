-- CreateEnum
CREATE TYPE "WorkerType" AS ENUM ('ELECTRICIAN', 'PLUMBER', 'PAINTER', 'CLEANER', 'DRIVER', 'COOK', 'LABOUR', 'GARDENER', 'OTHER');

-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('FIXED', 'PERHOUR', 'NEGOTIABLE');

-- CreateTable
CREATE TABLE "JobPoster" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeedAWorkerRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "workerType" "WorkerType" NOT NULL,
    "location" TEXT NOT NULL,
    "dateNeeded" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "budget" DECIMAL(10,2) NOT NULL,
    "budgetType" "BudgetType" NOT NULL,
    "isUrgentRequest" BOOLEAN NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeedAWorkerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeedAWorkerRequestRefPhoto" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "workRequestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeedAWorkerRequestRefPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobPoster_jobId_key" ON "JobPoster"("jobId");

-- CreateIndex
CREATE INDEX "JobPoster_jobId_idx" ON "JobPoster"("jobId");

-- CreateIndex
CREATE INDEX "NeedAWorkerRequest_requesterId_idx" ON "NeedAWorkerRequest"("requesterId");

-- CreateIndex
CREATE INDEX "NeedAWorkerRequestRefPhoto_workRequestId_idx" ON "NeedAWorkerRequestRefPhoto"("workRequestId");

-- AddForeignKey
ALTER TABLE "JobPoster" ADD CONSTRAINT "JobPoster_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeedAWorkerRequest" ADD CONSTRAINT "NeedAWorkerRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeedAWorkerRequestRefPhoto" ADD CONSTRAINT "NeedAWorkerRequestRefPhoto_workRequestId_fkey" FOREIGN KEY ("workRequestId") REFERENCES "NeedAWorkerRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
