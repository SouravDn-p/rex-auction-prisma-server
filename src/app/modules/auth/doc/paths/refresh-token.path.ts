export const refreshTokenPath = {
    post: {
      summary: "Refresh access token",
      description: "Issues new accessToken and refreshToken. Accepts the refreshToken from either the secure HTTP-only cookies or the request body. Both cookies will be rotated.",
      tags: ["Auth"],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                refreshToken: {
                  type: "string",
                  description: "Optional if set in HTTP-only cookie, otherwise required",
                  example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Token refreshed successfully",
          headers: {
            "Set-Cookie": {
              schema: {
                type: "string"
              },
              description: "Rotates and sets new accessToken and refreshToken cookies"
            }
          },
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Token refreshed" },
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
                          isActive: { type: "boolean", example: true }
                        }
                      },
                      accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Invalid or expired refresh token"
        }
      }
    }
  }