-- A UTR pays once: two students sending the same UTR at the same moment can't both be waiting or paid.
-- Partial index, so a UTR the school marked Not paid (FAILED) can be sent again. Prisma can't express this in schema.prisma.
CREATE UNIQUE INDEX "Payment_utr_pays_once" ON "Payment"("utr") WHERE "status" IN ('CREATED', 'PAID');
