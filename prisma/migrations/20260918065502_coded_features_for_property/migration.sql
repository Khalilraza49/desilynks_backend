/*
  Warnings:

  - You are about to drop the column `featuresAndAmenities` on the `Property` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Property" DROP COLUMN "featuresAndAmenities";

-- CreateTable
CREATE TABLE "PropertyFeatureAndAmenity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyFeatureAndAmenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PropertyToPropertyFeatureAndAmenity" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PropertyToPropertyFeatureAndAmenity_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "PropertyFeatureAndAmenity_title_idx" ON "PropertyFeatureAndAmenity"("title");

-- CreateIndex
CREATE INDEX "_PropertyToPropertyFeatureAndAmenity_B_index" ON "_PropertyToPropertyFeatureAndAmenity"("B");

-- AddForeignKey
ALTER TABLE "PropertyFeatureAndAmenity" ADD CONSTRAINT "PropertyFeatureAndAmenity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PropertyToPropertyFeatureAndAmenity" ADD CONSTRAINT "_PropertyToPropertyFeatureAndAmenity_A_fkey" FOREIGN KEY ("A") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PropertyToPropertyFeatureAndAmenity" ADD CONSTRAINT "_PropertyToPropertyFeatureAndAmenity_B_fkey" FOREIGN KEY ("B") REFERENCES "PropertyFeatureAndAmenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
