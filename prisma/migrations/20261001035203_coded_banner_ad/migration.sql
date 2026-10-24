-- CreateEnum
CREATE TYPE "BannerAdPosition" AS ENUM ('POPUP', 'HOME_SCREEN', 'JOBS_SCREEN', 'ROOMS_SCREEN', 'BOTTOM');

-- CreateEnum
CREATE TYPE "BannerAdStatus" AS ENUM ('RUNNING', 'PAUSED', 'EXPIRED');

-- CreateTable
CREATE TABLE "BannerAd" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ctaButtonText" TEXT NOT NULL,
    "destinationLink" TEXT NOT NULL,
    "position" "BannerAdPosition" NOT NULL,
    "status" "BannerAdStatus" NOT NULL DEFAULT 'RUNNING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BannerAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BannerAdPhoto" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "bannerAdId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BannerAdPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BannerAd_creatorId_idx" ON "BannerAd"("creatorId");

-- CreateIndex
CREATE INDEX "BannerAd_position_status_idx" ON "BannerAd"("position", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BannerAdPhoto_bannerAdId_key" ON "BannerAdPhoto"("bannerAdId");

-- CreateIndex
CREATE INDEX "BannerAdPhoto_bannerAdId_idx" ON "BannerAdPhoto"("bannerAdId");

-- AddForeignKey
ALTER TABLE "BannerAd" ADD CONSTRAINT "BannerAd_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BannerAdPhoto" ADD CONSTRAINT "BannerAdPhoto_bannerAdId_fkey" FOREIGN KEY ("bannerAdId") REFERENCES "BannerAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;
