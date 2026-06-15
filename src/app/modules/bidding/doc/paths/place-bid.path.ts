export const placeBidPath = {
  post: {
    summary: "Place a manual bid",
    description:
      "Place a bid on an active auction. Resolves auto-bid chains and updates live state. Real-time updates are also broadcast via Socket.IO on `/auction`.",
    tags: ["Bidding"],
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["auctionId", "amount"],
            properties: {
              auctionId: { type: "integer", example: 1 },
              amount: { type: "number", example: 5500.0 },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Bid placed successfully" },
      400: { description: "Validation error, bid too low, or insufficient balance" },
      401: { description: "Unauthorized" },
      403: { description: "Seller cannot bid on own auction" },
      404: { description: "Auction not found" },
      429: { description: "System busy — retry" },
    },
  },
};
