-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "JobApplicationStatus" AS ENUM ('PENDING', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "status" "JobStatus" NOT NULL DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "JobApplications" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "coverLetter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobApplications_jobId_idx" ON "JobApplications"("jobId");

-- CreateIndex
CREATE INDEX "JobApplications_applicantId_idx" ON "JobApplications"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplications_jobId_applicantId_key" ON "JobApplications"("jobId", "applicantId");

-- AddForeignKey
ALTER TABLE "JobApplications" ADD CONSTRAINT "JobApplications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplications" ADD CONSTRAINT "JobApplications_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
