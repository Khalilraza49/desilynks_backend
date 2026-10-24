-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'NEED_A_WORKER_POSTED';
ALTER TYPE "NotificationType" ADD VALUE 'WORKER_APPLICATION_WITHDRAWN';
ALTER TYPE "NotificationType" ADD VALUE 'PROPERTY_LIKED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "propertyId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_workRequestId_idx" ON "Notification"("workRequestId");

-- CreateIndex
CREATE INDEX "Notification_propertyId_idx" ON "Notification"("propertyId");
