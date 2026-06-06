export const mePath = {
    get: {
      summary: "Get current user profile",
      description: "Retrieve profile information of the currently authenticated user.",
      tags: ["Auth"],
      security: [
        {
          bearerAuth: []
        }
      ],
      responses: {
        200: {
          description: "User profile fetched successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "User fetched successfully" },
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "ckv1abcde0000xxxx" },
                          name: { type: "string", example: "John Doe" },
                          email: { type: "string", example: "john.doe@example.com" },
                          role: { type: "string", example: "user" },
                          isActive: { type: "boolean", example: true },
                          createdAt: { type: "string", format: "date-time" },
                          updatedAt: { type: "string", format: "date-time" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized"
        }
      }
    }
  }