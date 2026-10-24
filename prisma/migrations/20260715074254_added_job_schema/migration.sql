/*
  Warnings:

  - You are about to alter the column `monthlyRent` on the `Property` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.
  - You are about to alter the column `deposit` on the `Property` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,2)`.

*/
-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('RESTAURANT_AND_FOOD', 'DRIVING_AND_DELIVERY', 'CLEANING_AND_HOUSEKEEPING', 'CONSTRUCTION_AND_LABOUR', 'IT_AND_TECHNOLOGY', 'SALES_AND_MARKETING', 'HEALTHCARE', 'EDUCATION_AND_TEACHING', 'SECURITY_AND_GUARD', 'RETAIL_AND_SHOP', 'OTHER');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('PER_HOUR', 'PER_DAY', 'PER_WEEK', 'PER_MONTH');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "Experience" AS ENUM ('NO_EXPERIENCE', 'ONE_PLUS_YEARS', 'TWO_PLUS_YEARS', 'THREE_PLUS_YEARS', 'FIVE_PLUS_YEARS');

-- CreateEnum
CREATE TYPE "Education" AS ENUM ('HIGH_SCHOOL', 'BACHELOR', 'MASTER', 'PHD');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'SPANISH', 'URDU', 'HINDI', 'ARABIC');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('REMOTE', 'ONSITE', 'HYBRID');

-- CreateEnum
CREATE TYPE "Benefit" AS ENUM ('HEALTH_INSURANCE', 'FREE_MEALS', 'TRANSPORT', 'ACCOMMODATION', 'COMMISSION', 'PAID_LEAVE');

-- AlterTable
ALTER TABLE "Property" ALTER COLUMN "monthlyRent" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "deposit" SET DATA TYPE DECIMAL(10,2);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "category" "JobCategory" NOT NULL,
    "minSalary" DECIMAL(10,2) NOT NULL,
    "maxSalary" DECIMAL(10,2) NOT NULL,
    "salaryPeriod" "SalaryPeriod" NOT NULL,
    "type" "JobType" NOT NULL,
    "experience" "Experience" NOT NULL,
    "education" "Education" NOT NULL,
    "languages" "Language"[],
    "location" TEXT NOT NULL,
    "workMode" "WorkMode" NOT NULL,
    "description" TEXT NOT NULL,
    "requiredSkills" TEXT NOT NULL,
    "benefits" "Benefit"[],
    "applicationDeadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_employerId_idx" ON "Job"("employerId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
