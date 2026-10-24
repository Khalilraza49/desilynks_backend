-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'GROUP_MEMBER_BANNED';
ALTER TYPE "NotificationType" ADD VALUE 'GROUP_MEMBER_UNBANNED';
ALTER TYPE "NotificationType" ADD VALUE 'GROUP_ROLE_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'GROUP_EVENT_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'POST_REMOVED';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_INTEREST_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'EVENT_CANCELLED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "eventId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_postId_idx" ON "Notification"("postId");

-- CreateIndex
CREATE INDEX "Notification_groupId_idx" ON "Notification"("groupId");

-- CreateIndex
CREATE INDEX "Notification_eventId_idx" ON "Notification"("eventId");
