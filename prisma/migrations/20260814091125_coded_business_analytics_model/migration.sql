-- CreateTable
CREATE TABLE "BusinessListingDailyAnalytics" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessListingDailyAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessListingDailyAnalytics_businessId_date_idx" ON "BusinessListingDailyAnalytics"("businessId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessListingDailyAnalytics_businessId_date_key" ON "BusinessListingDailyAnalytics"("businessId", "date");

-- AddForeignKey
ALTER TABLE "BusinessListingDailyAnalytics" ADD CONSTRAINT "BusinessListingDailyAnalytics_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
