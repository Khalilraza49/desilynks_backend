-- AlterTable
ALTER TABLE "UserSupportForm" ADD COLUMN     "resolvedByAdminId" TEXT,
ADD COLUMN     "userId" TEXT;

-- AddForeignKey
ALTER TABLE "UserSupportForm" ADD CONSTRAINT "UserSupportForm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSupportForm" ADD CONSTRAINT "UserSupportForm_resolvedByAdminId_fkey" FOREIGN KEY ("resolvedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
