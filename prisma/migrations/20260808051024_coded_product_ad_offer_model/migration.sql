-- CreateEnum
CREATE TYPE "ProductAdOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ProductAdOffer" (
    "id" TEXT NOT NULL,
    "productAdId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "offerPrice" DECIMAL(10,2) NOT NULL,
    "message" TEXT,
    "status" "ProductAdOfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAdOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductAdOffer_productAdId_idx" ON "ProductAdOffer"("productAdId");

-- CreateIndex
CREATE INDEX "ProductAdOffer_buyerId_idx" ON "ProductAdOffer"("buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAdOffer_productAdId_buyerId_key" ON "ProductAdOffer"("productAdId", "buyerId");

-- AddForeignKey
ALTER TABLE "ProductAdOffer" ADD CONSTRAINT "ProductAdOffer_productAdId_fkey" FOREIGN KEY ("productAdId") REFERENCES "ProductAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAdOffer" ADD CONSTRAINT "ProductAdOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
