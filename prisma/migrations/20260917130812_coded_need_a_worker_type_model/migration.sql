-- CreateTable
CREATE TABLE "NeedAWorkerType" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeedAWorkerType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NeedAWorkerType_title_key" ON "NeedAWorkerType"("title");

-- CreateIndex
CREATE INDEX "NeedAWorkerType_title_idx" ON "NeedAWorkerType"("title");

-- AddForeignKey
ALTER TABLE "NeedAWorkerType" ADD CONSTRAINT "NeedAWorkerType_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
