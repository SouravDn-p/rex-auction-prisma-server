export const getAnnouncementPath = {
  get: {
    summary: "Get announcement by ID",
    description: "Fetch a single announcement. Admins can view inactive announcements.",
    tags: ["Announcements"],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    responses: {
      200: { description: "Announcement retrieved" },
      404: { description: "Announcement not found" },
    },
  },
};
