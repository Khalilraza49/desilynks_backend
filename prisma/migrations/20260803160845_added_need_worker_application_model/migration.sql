-- CreateEnum
CREATE TYPE "NeedAWorkerApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "NeedAWorkerApplication" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workRequestId" TEXT NOT NULL,
    "coverLetter" TEXT,
    "proposedPrice" DECIMAL(10,2),
    "status" "NeedAWorkerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeedAWorkerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NeedAWorkerApplication_workerId_idx" ON "NeedAWorkerApplication"("workerId");

-- CreateIndex
CREATE INDEX "NeedAWorkerApplication_workRequestId_idx" ON "NeedAWorkerApplication"("workRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "NeedAWorkerApplication_workerId_workRequestId_key" ON "NeedAWorkerApplication"("workerId", "workRequestId");

-- AddForeignKey
ALTER TABLE "NeedAWorkerApplication" ADD CONSTRAINT "NeedAWorkerApplication_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeedAWorkerApplication" ADD CONSTRAINT "NeedAWorkerApplication_workRequestId_fkey" FOREIGN KEY ("workRequestId") REFERENCES "NeedAWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
