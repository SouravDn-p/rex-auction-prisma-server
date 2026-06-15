export const markReadPath = {
  patch: {
    summary: "Mark conversation as read",
    description: "Marks all unread messages in a conversation as read.",
    tags: ["Chat"],
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["conversationId"],
            properties: {
              conversationId: { type: "integer", example: 1 },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Messages marked as read" },
      401: { description: "Unauthorized" },
      403: { description: "Access denied" },
      404: { description: "Conversation not found" },
    },
  },
};
