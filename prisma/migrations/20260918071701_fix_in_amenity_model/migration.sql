/*
  Warnings:

  - A unique constraint covering the columns `[title]` on the table `PropertyFeatureAndAmenity` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "PropertyFeatureAndAmenity_title_key" ON "PropertyFeatureAndAmenity"("title");
