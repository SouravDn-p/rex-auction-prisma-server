export const createAnnouncementPath = {
  post: {
    summary: "Create announcement",
    description: "Admin creates a new announcement. Optional image is uploaded as multipart and stored on Cloudinary.",
    tags: ["Announcements"],
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["title", "content"],
            properties: {
              title: { type: "string", example: "Platform Maintenance" },
              content: { type: "string", example: "Scheduled maintenance on Sunday at 2 AM UTC." },
              date: { type: "string", format: "date-time", example: "2026-06-20T02:00:00.000Z" },
              isActive: { type: "boolean", example: true },
              image: { type: "string", format: "binary", description: "Optional banner image" },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Announcement created successfully" },
      400: { description: "Validation error" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — admin role required" },
    },
  },
};
