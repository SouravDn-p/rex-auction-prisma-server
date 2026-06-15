import { adminPendingAuctionsPath } from "./paths/admin-pending.path.ts";
import { adminReviewAuctionPath } from "./paths/admin-review.path.ts";
import { createAuctionPath } from "./paths/create-auction.path.ts";
import { deleteAuctionPath } from "./paths/delete-auction.path.ts";
import { getAuctionPath } from "./paths/get-auction.path.ts";
import { listAuctionsPath } from "./paths/list-auctions.path.ts";
import { auctionReactionsPath } from "./paths/reactions.path.ts";
import { sellerAuctionsPath } from "./paths/seller-auctions.path.ts";
import { updateAuctionPath } from "./paths/update-auction.path.ts";

export const auctionsPaths = {
  "/auctions": {
    ...listAuctionsPath,
    ...createAuctionPath,
  },
  "/auctions/seller/mine": sellerAuctionsPath,
  "/auctions/admin/pending": adminPendingAuctionsPath,
  "/auctions/admin/{id}/review": adminReviewAuctionPath,
  "/auctions/{id}": {
    ...getAuctionPath,
    ...updateAuctionPath,
    ...deleteAuctionPath,
  },
  "/auctions/{id}/reactions": auctionReactionsPath,
};
