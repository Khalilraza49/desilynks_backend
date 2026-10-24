-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WORK_REQUEST_WITHDRAWN';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "workerProfileId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_workerProfileId_idx" ON "Notification"("workerProfileId");
