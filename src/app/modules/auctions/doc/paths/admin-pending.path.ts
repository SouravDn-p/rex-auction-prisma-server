export const adminPendingAuctionsPath = {
  get: {
    summary: "List pending auctions (admin)",
    description: "Admin retrieves auctions awaiting review.",
    tags: ["Auctions"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "page", in: "query", schema: { type: "integer", example: 1 } },
      { name: "limit", in: "query", schema: { type: "integer", example: 20 } },
    ],
    responses: {
      200: { description: "Pending auctions retrieved successfully" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — admin role required" },
    },
  },
};
