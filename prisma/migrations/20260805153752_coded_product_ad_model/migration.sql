-- CreateEnum
CREATE TYPE "ProductAdCategory" AS ENUM ('PHONES', 'CARS', 'ELECTRONICS', 'FURNITURE', 'CLOTHES', 'BOOKS', 'KIDS', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'FOR_PARTS');

-- CreateTable
CREATE TABLE "ProductAd" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "category" "ProductAdCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "condition" "ProductCondition" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "negotiable" BOOLEAN NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPhoto" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "productAdId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVideo" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "productAdId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductAd_category_idx" ON "ProductAd"("category");

-- CreateIndex
CREATE INDEX "ProductAd_condition_idx" ON "ProductAd"("condition");

-- CreateIndex
CREATE INDEX "ProductPhoto_productAdId_idx" ON "ProductPhoto"("productAdId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVideo_productAdId_key" ON "ProductVideo"("productAdId");

-- CreateIndex
CREATE INDEX "ProductVideo_productAdId_idx" ON "ProductVideo"("productAdId");

-- AddForeignKey
ALTER TABLE "ProductAd" ADD CONSTRAINT "ProductAd_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPhoto" ADD CONSTRAINT "ProductPhoto_productAdId_fkey" FOREIGN KEY ("productAdId") REFERENCES "ProductAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVideo" ADD CONSTRAINT "ProductVideo_productAdId_fkey" FOREIGN KEY ("productAdId") REFERENCES "ProductAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;
