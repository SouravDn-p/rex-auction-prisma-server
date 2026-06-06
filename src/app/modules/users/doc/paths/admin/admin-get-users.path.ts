export const adminGetUsersPath = {
    get: {
      summary: "ADMIN: Fetch all users",
      description: "List all users on the platform. Accessible only by accounts with ADMIN role.",
      tags: ["Admin (Users)"],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Page number" },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 }, description: "Items per page" },
        { name: "search", in: "query", schema: { type: "string" }, description: "Search query for name or email" }
      ],
      responses: {
        200: {
          description: "All users retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "All users retrieved successfully" },
                  data: {
                    type: "object",
                    properties: {
                      users: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "integer", example: 1 },
                            name: { type: "string", example: "Jane Doe" },
                            email: { type: "string", example: "jane.doe@example.com" },
                            role: { type: "string", example: "ADMIN" },
                            isActive: { type: "boolean", example: true },
                            createdAt: { type: "string", format: "date-time" }
                          }
                        }
                      },
                      total: { type: "integer", example: 88 }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: "Unauthorized" },
        403: { description: "Forbidden - Admin access required" }
      }
    }
  }