-- Ambassadors also give their school's city and their class. Defaults only fill rows made before this; new rows must send both.
ALTER TABLE "Ambassador" ADD COLUMN "schoolCity" TEXT NOT NULL DEFAULT '', ADD COLUMN "grade" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Ambassador" ALTER COLUMN "schoolCity" DROP DEFAULT, ALTER COLUMN "grade" DROP DEFAULT;
