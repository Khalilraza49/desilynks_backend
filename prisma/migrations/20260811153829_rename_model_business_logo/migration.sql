/*
  Warnings:

  - You are about to drop the `BusinessProfilePhoto` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BusinessProfilePhoto" DROP CONSTRAINT "BusinessProfilePhoto_businessId_fkey";

-- DropTable
DROP TABLE "BusinessProfilePhoto";

-- CreateTable
CREATE TABLE "BusinessLogo" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessLogo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessLogo_businessId_key" ON "BusinessLogo"("businessId");

-- CreateIndex
CREATE INDEX "BusinessLogo_businessId_idx" ON "BusinessLogo"("businessId");

-- AddForeignKey
ALTER TABLE "BusinessLogo" ADD CONSTRAINT "BusinessLogo_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
