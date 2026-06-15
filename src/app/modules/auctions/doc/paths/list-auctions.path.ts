export const listAuctionsPath = {
  get: {
    summary: "List auctions",
    description: "Public paginated list of auctions with optional filters.",
    tags: ["Auctions"],
    parameters: [
      { name: "page", in: "query", schema: { type: "integer", example: 1 } },
      { name: "limit", in: "query", schema: { type: "integer", example: 20 } },
      {
        name: "status",
        in: "query",
        schema: {
          type: "string",
          enum: ["pending", "upcoming", "active", "ended", "cancelled"],
        },
      },
      { name: "category", in: "query", schema: { type: "string" } },
      { name: "sellerId", in: "query", schema: { type: "integer" } },
      { name: "search", in: "query", schema: { type: "string" } },
    ],
    responses: {
      200: { description: "Auctions retrieved successfully" },
    },
  },
};
