import type { Auction, Bid, LiveBid, EndedAuction } from "@prisma/client";

export type SafeAuction = Auction;

export interface PlaceBidPayload {
  auctionId: number;
  userId: number;
  amount: number;
}