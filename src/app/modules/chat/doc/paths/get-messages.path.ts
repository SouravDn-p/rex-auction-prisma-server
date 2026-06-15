export const getMessagesPath = {
  get: {
    summary: "Get conversation messages",
    description: "Cursor-based paginated message history for a conversation.",
    tags: ["Chat"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "conversationId", in: "path", required: true, schema: { type: "integer", example: 1 } },
      { name: "cursor", in: "query", schema: { type: "integer", description: "Message ID cursor for older messages" } },
      { name: "limit", in: "query", schema: { type: "integer", example: 30 } },
    ],
    responses: {
      200: { description: "Messages retrieved successfully" },
      401: { description: "Unauthorized" },
      403: { description: "Access denied" },
      404: { description: "Conversation not found" },
    },
  },
};
