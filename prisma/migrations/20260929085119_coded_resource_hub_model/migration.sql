-- CreateEnum
CREATE TYPE "ResourceHubCategory" AS ENUM ('IMMIGRATION', 'HOUSING', 'JOB_AND_WORK', 'HEALTHCARE', 'LEGAL_ADVICE', 'EDUCATION', 'BUSINESS', 'TAXES', 'TRANSPORT');

-- CreateTable
CREATE TABLE "ResourceHubArticle" (
    "id" TEXT NOT NULL,
    "category" "ResourceHubCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "writerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceHubArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceHubArticleSave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceHubArticleSave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourceHubArticle_category_idx" ON "ResourceHubArticle"("category");

-- CreateIndex
CREATE INDEX "ResourceHubArticleSave_articleId_idx" ON "ResourceHubArticleSave"("articleId");

-- CreateIndex
CREATE INDEX "ResourceHubArticleSave_userId_idx" ON "ResourceHubArticleSave"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceHubArticleSave_userId_articleId_key" ON "ResourceHubArticleSave"("userId", "articleId");

-- AddForeignKey
ALTER TABLE "ResourceHubArticle" ADD CONSTRAINT "ResourceHubArticle_writerId_fkey" FOREIGN KEY ("writerId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceHubArticleSave" ADD CONSTRAINT "ResourceHubArticleSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceHubArticleSave" ADD CONSTRAINT "ResourceHubArticleSave_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "ResourceHubArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
