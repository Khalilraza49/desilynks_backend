-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('POST_LIKED', 'POST_COMMENTED', 'POST_SHARED', 'COMMENT_REPLIED', 'WORK_REQUEST_RECEIVED', 'WORK_REQUEST_ACCEPTED', 'WORK_REQUEST_REJECTED', 'WORKER_APPLICATION_RECEIVED', 'WORKER_APPLICATION_ACCEPTED', 'WORKER_APPLICATION_REJECTED', 'JOB_APPLICATION_RECEIVED', 'JOB_APPLICATION_STATUS_UPDATED', 'PRODUCT_OFFER_RECEIVED', 'PRODUCT_OFFER_ACCEPTED', 'PRODUCT_OFFER_REJECTED', 'GROUP_JOIN_REQUEST', 'GROUP_JOIN_APPROVED', 'GROUP_JOIN_REJECTED', 'GROUP_MEMBER_REMOVED', 'CHAT_MESSAGE');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "workRequestId" TEXT,
    "jobApplicationId" TEXT,
    "productAdOfferId" TEXT,
    "groupId" TEXT,
    "needAWorkerAppId" TEXT,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_recipientId_isRead_idx" ON "Notification"("recipientId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_actorId_idx" ON "Notification"("actorId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
