export const deleteAnnouncementPath = {
  delete: {
    summary: "Delete announcement",
    description: "Admin deletes an announcement.",
    tags: ["Announcements"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    responses: {
      200: { description: "Announcement deleted successfully" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — admin role required" },
      404: { description: "Announcement not found" },
    },
  },
};
