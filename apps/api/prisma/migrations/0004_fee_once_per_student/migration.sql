-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_registrationId_fkey";

-- DropIndex
DROP INDEX "Payment_registrationId_idx";

-- DropIndex
DROP INDEX "Registration_eventId_status_idx";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "feePaise";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "registrationId",
ADD COLUMN     "studentId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Registration" DROP COLUMN "status";

-- DropEnum
DROP TYPE "RegistrationStatus";

-- CreateIndex
CREATE INDEX "Payment_studentId_idx" ON "Payment"("studentId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

