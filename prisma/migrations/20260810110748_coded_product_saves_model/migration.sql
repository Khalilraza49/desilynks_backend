-- CreateTable
CREATE TABLE "ProductAdSave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productAdId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAdSave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductAdSave_productAdId_idx" ON "ProductAdSave"("productAdId");

-- CreateIndex
CREATE INDEX "ProductAdSave_userId_idx" ON "ProductAdSave"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAdSave_userId_productAdId_key" ON "ProductAdSave"("userId", "productAdId");

-- AddForeignKey
ALTER TABLE "ProductAdSave" ADD CONSTRAINT "ProductAdSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAdSave" ADD CONSTRAINT "ProductAdSave_productAdId_fkey" FOREIGN KEY ("productAdId") REFERENCES "ProductAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;
