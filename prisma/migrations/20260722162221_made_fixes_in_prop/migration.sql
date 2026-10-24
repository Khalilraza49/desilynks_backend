/*
  Warnings:

  - You are about to drop the `WorkCerificate` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `contactPreference` to the `Property` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "WorkCerificate" DROP CONSTRAINT "WorkCerificate_workerProfileId_fkey";

-- DropIndex
DROP INDEX "WorkPhoto_workerProfileId_key";

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "contactPreference" "ContactPreference" NOT NULL;

-- DropTable
DROP TABLE "WorkCerificate";

-- CreateTable
CREATE TABLE "WorkCertificate" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "workerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkCertificate_workerProfileId_idx" ON "WorkCertificate"("workerProfileId");

-- AddForeignKey
ALTER TABLE "WorkCertificate" ADD CONSTRAINT "WorkCertificate_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
