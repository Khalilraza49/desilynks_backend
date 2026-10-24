-- CreateEnum
CREATE TYPE "ProductAdStatus" AS ENUM ('ACTIVE', 'PENDING', 'INACTIVE');

-- AlterTable
ALTER TABLE "ProductAd" ADD COLUMN     "status" "ProductAdStatus" NOT NULL DEFAULT 'ACTIVE';
