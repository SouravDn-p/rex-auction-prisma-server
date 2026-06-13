/*
  Warnings:

  - Added the required column `history` to the `auctions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `auctions` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `auctions` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "AutoBidStatus" AS ENUM ('active', 'outbid_exceeded', 'cancelled', 'won');

-- AlterEnum
ALTER TYPE "AuctionStatus" ADD VALUE 'pending';

-- AlterTable
ALTER TABLE "auctions" ADD COLUMN     "history" TEXT NOT NULL,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imagePublicId" TEXT;

-- CreateTable
CREATE TABLE "auto_bids" (
    "id" SERIAL NOT NULL,
    "auctionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "maxBid" DECIMAL(12,2) NOT NULL,
    "incrementStep" DECIMAL(12,2) NOT NULL,
    "status" "AutoBidStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_bids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auto_bids_auctionId_status_idx" ON "auto_bids"("auctionId", "status");

-- CreateIndex
CREATE INDEX "auto_bids_userId_idx" ON "auto_bids"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auto_bids_auctionId_userId_key" ON "auto_bids"("auctionId", "userId");

-- AddForeignKey
ALTER TABLE "auto_bids" ADD CONSTRAINT "auto_bids_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "auctions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_bids" ADD CONSTRAINT "auto_bids_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
