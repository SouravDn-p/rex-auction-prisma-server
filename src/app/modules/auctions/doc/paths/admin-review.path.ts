export const adminReviewAuctionPath = {
  patch: {
    summary: "Review auction (admin)",
    description: "Admin approves (upcoming) or rejects (cancelled) a pending auction.",
    tags: ["Auctions"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["status"],
            properties: {
              status: {
                type: "string",
                enum: ["upcoming", "cancelled"],
                example: "upcoming",
              },
              notes: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Auction approved or rejected" },
      400: { description: "Auction is not pending" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — admin role required" },
      404: { description: "Auction not found" },
    },
  },
};
