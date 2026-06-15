export const updateAnnouncementPath = {
  patch: {
    summary: "Update announcement",
    description: "Admin updates an announcement. Upload a new image file to replace the existing one.",
    tags: ["Announcements"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" },
              date: { type: "string", format: "date-time" },
              isActive: { type: "boolean" },
              image: { type: "string", format: "binary", description: "Optional new banner image" },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Announcement updated successfully" },
      400: { description: "Validation error" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — admin role required" },
      404: { description: "Announcement not found" },
    },
  },
};
