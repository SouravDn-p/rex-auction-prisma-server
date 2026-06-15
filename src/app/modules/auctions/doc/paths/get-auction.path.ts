export const getAuctionPath = {
  get: {
    summary: "Get auction by ID",
    description: "Fetch full auction details including recent bids and seller info.",
    tags: ["Auctions"],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    responses: {
      200: { description: "Auction retrieved successfully" },
      404: { description: "Auction not found" },
    },
  },
};
