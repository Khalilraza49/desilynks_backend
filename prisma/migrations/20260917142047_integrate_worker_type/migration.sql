/*
  Warnings:

  - You are about to drop the column `workerType` on the `NeedAWorker` table. All the data in the column will be lost.
  - Added the required column `workerTypeId` to the `NeedAWorker` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "NeedAWorker" DROP COLUMN "workerType",
ADD COLUMN     "workerTypeId" TEXT NOT NULL;

-- DropEnum
DROP TYPE "WorkerType";

-- AddForeignKey
ALTER TABLE "NeedAWorker" ADD CONSTRAINT "NeedAWorker_workerTypeId_fkey" FOREIGN KEY ("workerTypeId") REFERENCES "NeedAWorkerType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
