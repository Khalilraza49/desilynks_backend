-- CreateTable
CREATE TABLE "ExploreCountry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "population" BIGINT NOT NULL,
    "language" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "capital" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExploreCountry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExploreCountryBanner" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "exploreCountryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExploreCountryBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExploreCountryEmergencyNumber" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "exploreCountryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExploreCountryEmergencyNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExploreCountryPopularCity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exploreCountryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExploreCountryPopularCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExploreCountryCityBanner" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "exploreCountryPopularCityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExploreCountryCityBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExploreCountry_name_key" ON "ExploreCountry"("name");

-- CreateIndex
CREATE INDEX "ExploreCountry_name_idx" ON "ExploreCountry"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExploreCountryBanner_exploreCountryId_key" ON "ExploreCountryBanner"("exploreCountryId");

-- CreateIndex
CREATE INDEX "ExploreCountryBanner_exploreCountryId_idx" ON "ExploreCountryBanner"("exploreCountryId");

-- CreateIndex
CREATE INDEX "ExploreCountryEmergencyNumber_exploreCountryId_idx" ON "ExploreCountryEmergencyNumber"("exploreCountryId");

-- CreateIndex
CREATE UNIQUE INDEX "ExploreCountryEmergencyNumber_title_exploreCountryId_key" ON "ExploreCountryEmergencyNumber"("title", "exploreCountryId");

-- CreateIndex
CREATE UNIQUE INDEX "ExploreCountryEmergencyNumber_number_exploreCountryId_key" ON "ExploreCountryEmergencyNumber"("number", "exploreCountryId");

-- CreateIndex
CREATE INDEX "ExploreCountryPopularCity_name_idx" ON "ExploreCountryPopularCity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExploreCountryPopularCity_name_exploreCountryId_key" ON "ExploreCountryPopularCity"("name", "exploreCountryId");

-- CreateIndex
CREATE UNIQUE INDEX "ExploreCountryCityBanner_exploreCountryPopularCityId_key" ON "ExploreCountryCityBanner"("exploreCountryPopularCityId");

-- CreateIndex
CREATE INDEX "ExploreCountryCityBanner_exploreCountryPopularCityId_idx" ON "ExploreCountryCityBanner"("exploreCountryPopularCityId");

-- AddForeignKey
ALTER TABLE "ExploreCountryBanner" ADD CONSTRAINT "ExploreCountryBanner_exploreCountryId_fkey" FOREIGN KEY ("exploreCountryId") REFERENCES "ExploreCountry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExploreCountryEmergencyNumber" ADD CONSTRAINT "ExploreCountryEmergencyNumber_exploreCountryId_fkey" FOREIGN KEY ("exploreCountryId") REFERENCES "ExploreCountry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExploreCountryPopularCity" ADD CONSTRAINT "ExploreCountryPopularCity_exploreCountryId_fkey" FOREIGN KEY ("exploreCountryId") REFERENCES "ExploreCountry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExploreCountryCityBanner" ADD CONSTRAINT "ExploreCountryCityBanner_exploreCountryPopularCityId_fkey" FOREIGN KEY ("exploreCountryPopularCityId") REFERENCES "ExploreCountryPopularCity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
