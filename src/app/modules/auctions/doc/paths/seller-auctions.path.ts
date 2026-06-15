export const sellerAuctionsPath = {
  get: {
    summary: "Get seller's own auctions",
    description: "Seller dashboard — list auctions created by the authenticated seller.",
    tags: ["Auctions"],
    security: [{ cookieAuth: [] }],
    parameters: [
      {
        name: "status",
        in: "query",
        schema: {
          type: "string",
          enum: ["pending", "upcoming", "active", "ended", "cancelled"],
        },
      },
      { name: "page", in: "query", schema: { type: "integer", example: 1 } },
      { name: "limit", in: "query", schema: { type: "integer", example: 20 } },
    ],
    responses: {
      200: { description: "Seller auctions retrieved successfully" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — seller role required" },
    },
  },
};
