export const sendMessagePath = {
  post: {
    summary: "Send message",
    description: "Send a message in an existing conversation.",
    tags: ["Chat"],
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["conversationId", "text"],
            properties: {
              conversationId: { type: "integer", example: 1 },
              text: { type: "string", example: "Hello, is this item still available?" },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Message sent successfully" },
      400: { description: "Validation error" },
      401: { description: "Unauthorized" },
      403: { description: "Access denied" },
      404: { description: "Conversation not found" },
    },
  },
};
