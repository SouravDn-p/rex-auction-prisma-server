/*
  Warnings:

  - The `deliveryStatus` column on the `auctions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `photo` on the `live_bids` table. All the data in the column will be lost.
  - You are about to drop the `bids` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `itemCondition` to the `auctions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemReference` to the `auctions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemValuation` to the `auctions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `itemYear` to the `auctions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PICKED', 'INTRANSIT', 'DELIVERED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "bids" DROP CONSTRAINT "bids_auctionId_fkey";

-- DropForeignKey
ALTER TABLE "bids" DROP CONSTRAINT "bids_userId_fkey";

-- AlterTable
ALTER TABLE "auctions" ADD COLUMN     "itemCondition" VARCHAR(50) NOT NULL,
ADD COLUMN     "itemReference" VARCHAR(100) NOT NULL,
ADD COLUMN     "itemValuation" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "itemYear" INTEGER NOT NULL,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
DROP COLUMN "deliveryStatus",
ADD COLUMN     "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "ended_auctions" ADD COLUMN     "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "live_bids" DROP COLUMN "photo";

-- DropTable
DROP TABLE "bids";
