-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'AWAITING_PAYMENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "PaymentStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "amountPaid" DECIMAL(12,2),
ADD COLUMN     "paymentDueAt" TIMESTAMP(3),
ADD COLUMN     "pickupDeadline" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN     "gcashEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gcashName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gcashNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gcashQrUrl" TEXT,
ADD COLUMN     "paymentWindowMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "pickupHoldHours" INTEGER NOT NULL DEFAULT 2,
ALTER COLUMN "shopName" SET DEFAULT 'Piraso';

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "image" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "note" TEXT,
    "submittedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentProof_orderId_createdAt_idx" ON "PaymentProof"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_paymentDueAt_idx" ON "Order"("paymentDueAt");

-- CreateIndex
CREATE INDEX "Order_pickupDeadline_idx" ON "Order"("pickupDeadline");

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Settings the owner controls must stay within sensible ranges.
ALTER TABLE "ShopSettings" ADD CONSTRAINT "shopsettings_payment_window" CHECK ("paymentWindowMinutes" BETWEEN 1 AND 240);
ALTER TABLE "ShopSettings" ADD CONSTRAINT "shopsettings_pickup_hold" CHECK ("pickupHoldHours" BETWEEN 1 AND 72);

-- ── Data updates for existing databases ─────────────────────────────────────────────────
-- Rebrand: the shop is now called Piraso (only if the owner kept the old default name).
UPDATE "ShopSettings" SET "shopName" = 'Piraso' WHERE "shopName" = 'Porkshop';

-- Ground pork: the client asked for the main name and the shop-sign name to be swapped.
-- Only applied if the owner hasn't renamed the product themselves.
UPDATE "Product"
SET "name" = 'Ground Pork', "localName" = 'Pork Giniling', "slug" = 'ground-pork', "updatedAt" = now()
WHERE "sku" = 'PK-GRD' AND "name" = 'Pork Giniling'
  AND NOT EXISTS (SELECT 1 FROM "Product" p WHERE p."slug" = 'ground-pork');
