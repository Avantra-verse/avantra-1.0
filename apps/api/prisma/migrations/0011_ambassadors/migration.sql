-- School coordinators are replaced by student ambassadors; students type their school name.
-- Data-safe: any coordinator account becomes an AMBASSADOR (with no profile yet), every student keeps their school name.
ALTER TYPE "Role" RENAME VALUE 'SCHOOL_COORDINATOR' TO 'AMBASSADOR';

ALTER TABLE "Student" ADD COLUMN "schoolName" TEXT, ADD COLUMN "referredById" TEXT;
UPDATE "Student" s SET "schoolName" = COALESCE((SELECT sc.name FROM "School" sc WHERE sc.id = s."schoolId"), s."otherSchoolName", '');
ALTER TABLE "Student" ALTER COLUMN "schoolName" SET NOT NULL;

ALTER TABLE "Student" DROP CONSTRAINT "Student_schoolId_fkey";
DROP INDEX "Student_schoolId_idx";
ALTER TABLE "Student" DROP COLUMN "otherSchoolName", DROP COLUMN "schoolId";
DROP TABLE "School";
DROP TYPE "SchoolStatus";

CREATE TABLE "Ambassador" (
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ambassador_pkey" PRIMARY KEY ("userId")
);
CREATE UNIQUE INDEX "Ambassador_code_key" ON "Ambassador"("code");
CREATE INDEX "Student_referredById_idx" ON "Student"("referredById");
ALTER TABLE "Ambassador" ADD CONSTRAINT "Ambassador_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Ambassador"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
