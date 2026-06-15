/*
  Warnings:

  - The values [pending,success,failed,refunded] on the enum `PaymentStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `blogs` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[invoiceNumber]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `announcements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `blogs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');
ALTER TABLE "public"."auctions" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "public"."ended_auctions" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "public"."payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "auctions" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new" USING ("paymentStatus"::text::"PaymentStatus_new");
ALTER TABLE "ended_auctions" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new" USING ("paymentStatus"::text::"PaymentStatus_new");
ALTER TABLE "payments" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "auctions" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';
ALTER TABLE "ended_auctions" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'seller_earning';
ALTER TYPE "TransactionType" ADD VALUE 'platform_fee';
ALTER TYPE "TransactionType" ADD VALUE 'refund';

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "auctions" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "blogs" ADD COLUMN     "excerpt" VARCHAR(500),
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" VARCHAR(300) NOT NULL,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ended_auctions" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "invoiceNumber" VARCHAR(50),
ADD COLUMN     "ipnData" JSONB,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "sellerProceeds" DECIMAL(12,2),
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "announcements_isActive_createdAt_idx" ON "announcements"("isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "blogs_slug_key" ON "blogs"("slug");

-- CreateIndex
CREATE INDEX "blogs_isPublished_createdAt_idx" ON "blogs"("isPublished", "createdAt");

-- CreateIndex
CREATE INDEX "blogs_slug_idx" ON "blogs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoiceNumber_key" ON "payments"("invoiceNumber");

-- CreateIndex
CREATE INDEX "payments_trxId_idx" ON "payments"("trxId");
