export const getConversationPath = {
  get: {
    summary: "Get conversation by ID",
    description: "Fetch conversation details including the other participant.",
    tags: ["Chat"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    responses: {
      200: { description: "Conversation retrieved successfully" },
      401: { description: "Unauthorized" },
      403: { description: "Access denied" },
      404: { description: "Conversation not found" },
    },
  },
  delete: {
    summary: "Delete conversation (soft)",
    description: "Removes the conversation from the current user's inbox.",
    tags: ["Chat"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    responses: {
      200: { description: "Conversation removed from inbox" },
      401: { description: "Unauthorized" },
      403: { description: "Access denied" },
      404: { description: "Conversation not found" },
    },
  },
};
