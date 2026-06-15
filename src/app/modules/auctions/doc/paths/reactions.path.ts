export const auctionReactionsPath = {
  post: {
    summary: "Add or update reaction",
    description: "Authenticated user reacts to an auction (like, love, smile, wow, flag).",
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
            required: ["reaction"],
            properties: {
              reaction: {
                type: "string",
                enum: ["like", "love", "smile", "wow", "flag"],
                example: "like",
              },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Reaction added successfully" },
      400: { description: "Validation error" },
      401: { description: "Unauthorized" },
      404: { description: "Auction not found" },
    },
  },
  delete: {
    summary: "Remove reaction",
    description: "Remove the authenticated user's reaction from an auction.",
    tags: ["Auctions"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    responses: {
      200: { description: "Reaction removed successfully" },
      401: { description: "Unauthorized" },
    },
  },
};
