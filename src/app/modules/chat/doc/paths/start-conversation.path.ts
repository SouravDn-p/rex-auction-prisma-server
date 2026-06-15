export const startConversationPath = {
  post: {
    summary: "Start or find conversation",
    description: "Creates a conversation shell with another user, or returns the existing one.",
    tags: ["Chat"],
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["otherUserId"],
            properties: {
              otherUserId: { type: "integer", example: 2 },
              auctionId: { type: "integer", example: 5, description: "Optional auction context" },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Conversation ready" },
      400: { description: "Cannot message yourself" },
      401: { description: "Unauthorized" },
      404: { description: "User not found" },
    },
  },
};
