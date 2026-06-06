export const logoutPath = {
    post: {
      summary: "Logout user",
      description: "Logs out the authenticated user by invalidating the refresh token in the database and clearing client-side cookies.",
      tags: ["Auth"],
      security: [
        {
          bearerAuth: []
        }
      ],
      responses: {
        200: {
          description: "Logged out successfully",
          headers: {
            "Set-Cookie": {
              schema: {
                type: "string"
              },
              description: "Clears accessToken and refreshToken cookies"
            }
          },
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Logged out successfully" }
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