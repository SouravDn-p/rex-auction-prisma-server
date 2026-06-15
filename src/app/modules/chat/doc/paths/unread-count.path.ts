export const unreadCountPath = {
  get: {
    summary: "Get total unread message count",
    description: "Returns total unread messages across all conversations.",
    tags: ["Chat"],
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: "Unread count retrieved" },
      401: { description: "Unauthorized" },
    },
  },
};
