/*
  Warnings:

  - You are about to drop the column `website` on the `BusinessListing` table. All the data in the column will be lost.
  - You are about to drop the `BusinessLogo` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BusinessLogo" DROP CONSTRAINT "BusinessLogo_businessId_fkey";

-- AlterTable
ALTER TABLE "BusinessListing" DROP COLUMN "website";

-- DropTable
DROP TABLE "BusinessLogo";
