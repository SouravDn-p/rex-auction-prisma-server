export const adminToggleUsersStatusPath = {
    patch: {
      summary: "ADMIN: Toggle user status",
      description: "Deactivate or reactivate a user account. Deactivated users cannot log in.",
      tags: ["Admin (Users)"],
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: "userId", in: "path", required: true, schema: { type: "integer" }, description: "The target user ID" }
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["isActive"],
              properties: {
                isActive: { type: "boolean", example: false }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "User status updated successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "User deactivated successfully" },
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 42 },
                          name: { type: "string" },
                          email: { type: "string" },
                          role: { type: "string" },
                          isActive: { type: "boolean", example: false }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: "Cannot update your own active status" },
        401: { description: "Unauthorized" },
        403: { description: "Forbidden - Admin access required" },
        404: { description: "User not found" }
      }
    }
  }