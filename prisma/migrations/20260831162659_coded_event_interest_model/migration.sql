-- AlterTable
ALTER TABLE "CommunityEvent" ADD COLUMN     "interestsCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CommunityEventInterest" (
    "id" TEXT NOT NULL,
    "interestedUserId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityEventInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityEventInterest_interestedUserId_idx" ON "CommunityEventInterest"("interestedUserId");

-- CreateIndex
CREATE INDEX "CommunityEventInterest_eventId_idx" ON "CommunityEventInterest"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityEventInterest_interestedUserId_eventId_key" ON "CommunityEventInterest"("interestedUserId", "eventId");

-- AddForeignKey
ALTER TABLE "CommunityEventInterest" ADD CONSTRAINT "CommunityEventInterest_interestedUserId_fkey" FOREIGN KEY ("interestedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityEventInterest" ADD CONSTRAINT "CommunityEventInterest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
