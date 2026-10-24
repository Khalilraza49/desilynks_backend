/*
  Warnings:

  - You are about to drop the column `applicationDeadline` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `benefits` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `education` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `maxSalary` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `minSalary` on the `Job` table. All the data in the column will be lost.
  - Added the required column `salary` to the `Job` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Job" DROP COLUMN "applicationDeadline",
DROP COLUMN "benefits",
DROP COLUMN "education",
DROP COLUMN "maxSalary",
DROP COLUMN "minSalary",
ADD COLUMN     "salary" DECIMAL(10,2) NOT NULL;

-- DropEnum
DROP TYPE "Benefit";

-- DropEnum
DROP TYPE "Education";
