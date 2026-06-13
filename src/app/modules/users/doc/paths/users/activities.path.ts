export const activitiesPath = {
    get: {
      summary: "Get user activity logs",
      description: "Retrieve paginated history of security, bidding, and account events.",
      tags: ["Users"],
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Page number" },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 }, description: "Items per page" }
      ],
      responses: {
        200: {
          description: "Activities retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "User activities retrieved successfully" },
                  data: {
                    type: "object",
                    properties: {
                      activities: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "integer", example: 100 },
                            userId: { type: "integer", example: 42 },
                            activityType: { type: "string", example: "profile_updated" },
                            description: { type: "string", example: "Updated profile details" },
                            metadata: { type: "object" },
                            createdAt: { type: "string", format: "date-time" }
                          }
                        }
                      },
                      total: { type: "integer", example: 15 },
                      page: { type: "integer", example: 1 },
                      limit: { type: "integer", example: 20 }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: "Unauthorized" }
      }
    }
  }