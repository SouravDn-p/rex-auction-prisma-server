import {
  cancelAutoBidPath,
  getAutoBidPath,
  setAutoBidPath,
} from "./paths/autobid.path.ts";
import { placeBidPath } from "./paths/place-bid.path.ts";

export const biddingPaths = {
  "/bidding/place": placeBidPath,
  "/bidding/autobid": setAutoBidPath,
  "/bidding/autobid/{auctionId}": {
    ...cancelAutoBidPath,
    ...getAutoBidPath,
  },
};
