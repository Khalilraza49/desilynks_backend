/*
  Warnings:

  - You are about to drop the column `createAt` on the `UserAddress` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "WorkerService" AS ENUM ('ELECTRICIAN', 'PLUMBER', 'PAINTER', 'CLEANER', 'DRIVER', 'CHEF', 'CONSTRUCTION_WORKER', 'GARDENER', 'COURIER', 'HANDYMAN', 'BARBER', 'PET_SITTER', 'IT_SUPPORT', 'PHOTOGRAPHER', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkRequestType" AS ENUM ('ONETIME', 'RECURRING');

-- CreateEnum
CREATE TYPE "WorkRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "UserAddress" DROP COLUMN "createAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "WorkerProfile" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "service" "WorkerService" NOT NULL,
    "experienceInYears" INTEGER NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "dailyRate" DECIMAL(10,2) NOT NULL,
    "languagesSpoken" TEXT[],
    "isAvailableToday" BOOLEAN NOT NULL,
    "ownVehicle" BOOLEAN NOT NULL,
    "ownTools" BOOLEAN NOT NULL,
    "areaCovered" TEXT NOT NULL,
    "about" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerProfilePhoto" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "workerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerProfilePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkCerificate" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "workerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkCerificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkPhoto" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "workerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "workerProfileId" TEXT NOT NULL,
    "service" "WorkerService" NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "budget" DECIMAL(10,2) NOT NULL,
    "type" "WorkRequestType" NOT NULL,
    "schedule" TIMESTAMP(3) NOT NULL,
    "status" "WorkRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_workerId_key" ON "WorkerProfile"("workerId");

-- CreateIndex
CREATE INDEX "WorkerProfile_workerId_idx" ON "WorkerProfile"("workerId");

-- CreateIndex
CREATE INDEX "WorkerProfile_service_idx" ON "WorkerProfile"("service");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfilePhoto_workerProfileId_key" ON "WorkerProfilePhoto"("workerProfileId");

-- CreateIndex
CREATE INDEX "WorkerProfilePhoto_workerProfileId_idx" ON "WorkerProfilePhoto"("workerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkCerificate_workerProfileId_key" ON "WorkCerificate"("workerProfileId");

-- CreateIndex
CREATE INDEX "WorkCerificate_workerProfileId_idx" ON "WorkCerificate"("workerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPhoto_workerProfileId_key" ON "WorkPhoto"("workerProfileId");

-- CreateIndex
CREATE INDEX "WorkPhoto_workerProfileId_idx" ON "WorkPhoto"("workerProfileId");

-- CreateIndex
CREATE INDEX "WorkRequest_requesterId_idx" ON "WorkRequest"("requesterId");

-- CreateIndex
CREATE INDEX "WorkRequest_workerProfileId_idx" ON "WorkRequest"("workerProfileId");

-- AddForeignKey
ALTER TABLE "WorkerProfile" ADD CONSTRAINT "WorkerProfile_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerProfilePhoto" ADD CONSTRAINT "WorkerProfilePhoto_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkCerificate" ADD CONSTRAINT "WorkCerificate_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPhoto" ADD CONSTRAINT "WorkPhoto_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkRequest" ADD CONSTRAINT "WorkRequest_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
