/*
  Warnings:

  - You are about to drop the column `billsIncluded` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `deposit` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the `PropertyVideoTour` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PropertyVideoTour" DROP CONSTRAINT "PropertyVideoTour_propertyId_fkey";

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "billsIncluded",
DROP COLUMN "deposit";

-- DropTable
DROP TABLE "PropertyVideoTour";
