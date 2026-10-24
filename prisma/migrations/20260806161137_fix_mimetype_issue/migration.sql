/*
  Warnings:

  - You are about to drop the column `mimeType` on the `JobPoster` table. All the data in the column will be lost.
  - You are about to drop the column `mimeType` on the `ProfilePhoto` table. All the data in the column will be lost.
  - You are about to drop the column `mimeType` on the `PropertyPhoto` table. All the data in the column will be lost.
  - You are about to drop the column `mimeType` on the `PropertyVideoTour` table. All the data in the column will be lost.
  - You are about to drop the column `mimeType` on the `WorkCertificate` table. All the data in the column will be lost.
  - You are about to drop the column `mimeType` on the `WorkPhoto` table. All the data in the column will be lost.
  - You are about to drop the column `mimeType` on the `WorkerProfilePhoto` table. All the data in the column will be lost.
  - Added the required column `mimetype` to the `JobPoster` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimetype` to the `ProfilePhoto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimetype` to the `PropertyPhoto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimetype` to the `PropertyVideoTour` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimetype` to the `WorkCertificate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimetype` to the `WorkPhoto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimetype` to the `WorkerProfilePhoto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "JobPoster" DROP COLUMN "mimeType",
ADD COLUMN     "mimetype" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProfilePhoto" DROP COLUMN "mimeType",
ADD COLUMN     "mimetype" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PropertyPhoto" DROP COLUMN "mimeType",
ADD COLUMN     "mimetype" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PropertyVideoTour" DROP COLUMN "mimeType",
ADD COLUMN     "mimetype" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkCertificate" DROP COLUMN "mimeType",
ADD COLUMN     "mimetype" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkPhoto" DROP COLUMN "mimeType",
ADD COLUMN     "mimetype" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkerProfilePhoto" DROP COLUMN "mimeType",
ADD COLUMN     "mimetype" TEXT NOT NULL;
