export interface PlaceBidInput {
    auctionId: number;
    userId: number;
    amount: number;
  }
  
  export interface SetAutoBidInput {
    auctionId: number;
    userId: number;
    maxBid: number;
    incrementStep: number;
  }
  
  export interface BidResolutionResult {
    finalAmount: string;
    finalBidderId: number;
    finalBidderName: string;
    isAutoBid: boolean;
    bidHistory: Array<{ userId: number; amount: string; isAutoBid: boolean }>;
  }