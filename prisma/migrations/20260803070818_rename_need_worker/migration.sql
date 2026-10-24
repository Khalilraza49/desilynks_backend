/*
  Warnings:

  - You are about to drop the `NeedAWorkerRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NeedAWorkerRequestRefPhoto` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "NeedAWorkerRequest" DROP CONSTRAINT "NeedAWorkerRequest_requesterId_fkey";

-- DropForeignKey
ALTER TABLE "NeedAWorkerRequestRefPhoto" DROP CONSTRAINT "NeedAWorkerRequestRefPhoto_workRequestId_fkey";

-- DropTable
DROP TABLE "NeedAWorkerRequest";

-- DropTable
DROP TABLE "NeedAWorkerRequestRefPhoto";

-- CreateTable
CREATE TABLE "NeedAWorker" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "workerType" "WorkerType" NOT NULL,
    "location" TEXT NOT NULL,
    "dateNeeded" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "budget" DECIMAL(10,2) NOT NULL,
    "budgetType" "BudgetType" NOT NULL,
    "isUrgentRequest" BOOLEAN NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeedAWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeedAWorkerRefPhoto" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "workRequestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeedAWorkerRefPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NeedAWorker_requesterId_idx" ON "NeedAWorker"("requesterId");

-- CreateIndex
CREATE INDEX "NeedAWorkerRefPhoto_workRequestId_idx" ON "NeedAWorkerRefPhoto"("workRequestId");

-- AddForeignKey
ALTER TABLE "NeedAWorker" ADD CONSTRAINT "NeedAWorker_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeedAWorkerRefPhoto" ADD CONSTRAINT "NeedAWorkerRefPhoto_workRequestId_fkey" FOREIGN KEY ("workRequestId") REFERENCES "NeedAWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
