-- DropIndex
DROP INDEX "CheckIn_studentId_idx";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "judgingCriteria" TEXT[] DEFAULT ARRAY['Innovation', 'Scientific understanding', 'Presentation', 'Practical impact']::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "assignedEventId" TEXT;

-- CreateIndex
CREATE INDEX "CheckIn_studentId_eventId_idx" ON "CheckIn"("studentId", "eventId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedEventId_fkey" FOREIGN KEY ("assignedEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

