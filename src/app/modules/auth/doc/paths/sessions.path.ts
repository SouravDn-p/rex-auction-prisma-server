export const sessionsPath = {
  get: {
    summary: "List active sessions",
    description: "Returns all active refresh-token sessions for the authenticated user.",
    tags: ["Auth"],
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Sessions fetched successfully",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                message: { type: "string" },
                data: {
                  type: "object",
                  properties: {
                    sessions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 1 },
                          ipAddress: { type: "string", nullable: true },
                          userAgent: { type: "string", nullable: true },
                          lastUsedAt: { type: "string", format: "date-time" },
                          createdAt: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: "Unauthorized" },
    },
  },
};
