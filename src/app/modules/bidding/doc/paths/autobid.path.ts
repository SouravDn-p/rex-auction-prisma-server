export const setAutoBidPath = {
  post: {
    summary: "Set or update auto-bid",
    description:
      "Configure maximum bid and increment step for an active auction. May immediately resolve against current leader.",
    tags: ["Bidding"],
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["auctionId", "maxBid", "incrementStep"],
            properties: {
              auctionId: { type: "integer", example: 1 },
              maxBid: { type: "number", example: 8000.0 },
              incrementStep: { type: "number", example: 100.0 },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Auto-bid configured successfully" },
      400: { description: "Validation error or insufficient balance" },
      401: { description: "Unauthorized" },
      403: { description: "Seller cannot bid on own auction" },
      404: { description: "Auction not found" },
    },
  },
};

export const cancelAutoBidPath = {
  delete: {
    summary: "Cancel auto-bid",
    description: "Cancel the authenticated user's active auto-bid for an auction.",
    tags: ["Bidding"],
    security: [{ cookieAuth: [] }],
    parameters: [
      {
        name: "auctionId",
        in: "path",
        required: true,
        schema: { type: "integer", example: 1 },
      },
    ],
    responses: {
      200: { description: "Auto-bid cancelled successfully" },
      401: { description: "Unauthorized" },
      404: { description: "No active auto-bid found" },
    },
  },
};

export const getAutoBidPath = {
  get: {
    summary: "Get my auto-bid",
    description: "Retrieve the authenticated user's auto-bid configuration for an auction.",
    tags: ["Bidding"],
    security: [{ cookieAuth: [] }],
    parameters: [
      {
        name: "auctionId",
        in: "path",
        required: true,
        schema: { type: "integer", example: 1 },
      },
    ],
    responses: {
      200: { description: "Auto-bid retrieved" },
      401: { description: "Unauthorized" },
    },
  },
};
