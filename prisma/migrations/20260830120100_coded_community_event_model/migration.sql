-- CreateEnum
CREATE TYPE "CommunityEventType" AS ENUM ('CELEBRATION', 'SPORTS', 'FOOD_AND_DINING', 'EDUCATION', 'RELIGIOUS', 'BUSINESS', 'MUSIC', 'GAMING');

-- CreateEnum
CREATE TYPE "CommunityEventVisibility" AS ENUM ('PUBLIC', 'GROUP', 'INVITE_ONLY');

-- CreateTable
CREATE TABLE "CommunityEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizerUserId" TEXT,
    "organizerGroupId" TEXT,
    "startDate" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL,
    "description" TEXT NOT NULL,
    "ticketPrice" DECIMAL(10,2) NOT NULL,
    "maxAttendees" INTEGER NOT NULL DEFAULT 0,
    "type" "CommunityEventType"[],
    "visibility" "CommunityEventVisibility" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityEventBanner" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityEventBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityEvent_visibility_idx" ON "CommunityEvent"("visibility");

-- CreateIndex
CREATE INDEX "CommunityEvent_organizerUserId_idx" ON "CommunityEvent"("organizerUserId");

-- CreateIndex
CREATE INDEX "CommunityEvent_organizerGroupId_idx" ON "CommunityEvent"("organizerGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityEventBanner_eventId_key" ON "CommunityEventBanner"("eventId");

-- CreateIndex
CREATE INDEX "CommunityEventBanner_eventId_idx" ON "CommunityEventBanner"("eventId");

-- AddForeignKey
ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_organizerUserId_fkey" FOREIGN KEY ("organizerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityEvent" ADD CONSTRAINT "CommunityEvent_organizerGroupId_fkey" FOREIGN KEY ("organizerGroupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityEventBanner" ADD CONSTRAINT "CommunityEventBanner_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
