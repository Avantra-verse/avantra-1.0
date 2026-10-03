-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "note" TEXT,
ADD COLUMN     "recordedById" TEXT;

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "certificateCode" TEXT,
ADD COLUMN     "certificateIssuedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "rank" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Registration_certificateCode_key" ON "Registration"("certificateCode");

