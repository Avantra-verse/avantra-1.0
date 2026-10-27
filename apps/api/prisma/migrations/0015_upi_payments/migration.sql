-- UPI QR payments: the student sends the UTR, the school checks it against its bank statement.
ALTER TYPE "PaymentMethod" ADD VALUE 'UPI';
ALTER TABLE "Payment" ADD COLUMN "utr" TEXT;
CREATE INDEX "Payment_utr_idx" ON "Payment"("utr");
