/*
  Warnings:

  - You are about to drop the column `endTime` on the `NeedAWorker` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `NeedAWorker` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "NeedAWorker" DROP COLUMN "endTime",
DROP COLUMN "startTime";
