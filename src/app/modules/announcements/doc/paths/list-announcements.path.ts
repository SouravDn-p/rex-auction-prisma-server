export const listAnnouncementsPath = {
  get: {
    summary: "List announcements",
    description: "Public paginated list of active announcements. Admins see all when authenticated.",
    tags: ["Announcements"],
    parameters: [
      { name: "page", in: "query", schema: { type: "integer", example: 1 } },
      { name: "limit", in: "query", schema: { type: "integer", example: 10 } },
    ],
    responses: {
      200: { description: "Announcements retrieved successfully" },
    },
  },
};
