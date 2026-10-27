-- Ambassadors now apply on a Google Form and get a code by email; the code is no longer an account.
-- Students keep the code they typed as plain text, so it survives the Ambassador table going away.
ALTER TABLE "Student" ADD COLUMN "referralCode" TEXT;
UPDATE "Student" s SET "referralCode" = a."code" FROM "Ambassador" a WHERE a."userId" = s."referredById";
ALTER TABLE "Student" DROP CONSTRAINT "Student_referredById_fkey";
DROP INDEX "Student_referredById_idx";
ALTER TABLE "Student" DROP COLUMN "referredById";
CREATE INDEX "Student_referralCode_idx" ON "Student"("referralCode");
DROP TABLE "Ambassador";

-- Ambassador logins go too (production had none on 2026-10-27; any left would be deleted with their sessions).
DELETE FROM "User" WHERE "role" = 'AMBASSADOR';
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('STUDENT', 'JUDGE', 'VOLUNTEER', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
DROP TYPE "Role_old";
