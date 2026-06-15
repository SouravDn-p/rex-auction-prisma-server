export const reportUserPath = {
  post: {
    summary: "Report a user",
    description: "Submit a report against another user from chat.",
    tags: ["Chat"],
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["reportedUserId", "reason"],
            properties: {
              reportedUserId: { type: "integer", example: 5 },
              reason: { type: "string", example: "Harassment" },
              description: { type: "string", example: "Sent inappropriate messages" },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "User reported successfully" },
      400: { description: "Validation error" },
      401: { description: "Unauthorized" },
      404: { description: "User not found" },
    },
  },
};
