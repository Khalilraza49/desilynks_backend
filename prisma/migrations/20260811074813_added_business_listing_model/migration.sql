-- CreateEnum
CREATE TYPE "BusinessCategory" AS ENUM ('GROCERY_AND_SUPERMARKET', 'RESTAURANT_AND_CAFE', 'SALON_AND_BEAUTY', 'MOBILE_AND_ELECTRONICS', 'CLOTHING_AND_FASHION', 'HEALTH_AND_PHARMACY', 'CAR_SERVICES', 'COURIER_AND_DELIVERY', 'EDUCATION_AND_TUTORING', 'MONEY_TRANSFER', 'TRAVEL_AGENCY', 'CONSTRUCTION', 'CLEANING_SERVICES', 'OTHER');

-- CreateEnum
CREATE TYPE "BusinessListingStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');

-- CreateTable
CREATE TABLE "BusinessListing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "BusinessCategory" NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsApp" TEXT,
    "website" TEXT,
    "description" TEXT NOT NULL,
    "status" "BusinessListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessHours" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "monToFriStartTime" TEXT NOT NULL,
    "monToFriEndTime" TEXT NOT NULL,
    "saturdayStartTime" TEXT NOT NULL,
    "saturdayEndTime" TEXT NOT NULL,
    "sundayStartTime" TEXT,
    "sundayEndTime" TEXT,
    "isClosedOnSunday" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessCoverPhoto" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessCoverPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProfilePhoto" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfilePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessGallery" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessGallery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessListing_ownerId_idx" ON "BusinessListing"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHours_businessId_key" ON "BusinessHours"("businessId");

-- CreateIndex
CREATE INDEX "BusinessHours_businessId_idx" ON "BusinessHours"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCoverPhoto_businessId_key" ON "BusinessCoverPhoto"("businessId");

-- CreateIndex
CREATE INDEX "BusinessCoverPhoto_businessId_idx" ON "BusinessCoverPhoto"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfilePhoto_businessId_key" ON "BusinessProfilePhoto"("businessId");

-- CreateIndex
CREATE INDEX "BusinessProfilePhoto_businessId_idx" ON "BusinessProfilePhoto"("businessId");

-- CreateIndex
CREATE INDEX "BusinessGallery_businessId_idx" ON "BusinessGallery"("businessId");

-- AddForeignKey
ALTER TABLE "BusinessListing" ADD CONSTRAINT "BusinessListing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCoverPhoto" ADD CONSTRAINT "BusinessCoverPhoto_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessProfilePhoto" ADD CONSTRAINT "BusinessProfilePhoto_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessGallery" ADD CONSTRAINT "BusinessGallery_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
