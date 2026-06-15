export const listConversationsPath = {
  get: {
    summary: "List conversations",
    description: "Returns sidebar conversation list with last message and unread counts.",
    tags: ["Chat"],
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: "Conversations retrieved successfully" },
      401: { description: "Unauthorized" },
    },
  },
};
