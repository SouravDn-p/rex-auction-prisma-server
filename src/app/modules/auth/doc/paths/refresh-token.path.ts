export const refreshTokenPath = {
  post: {
    summary: "Refresh access token",
    description:
      "Rotates accessToken and refreshToken using the refreshToken HttpOnly cookie. New cookies are set on the response. Tokens are not returned in the JSON body.",
    tags: ["Auth"],
    responses: {
      200: {
        description: "Token refreshed successfully",
        headers: {
          "Set-Cookie": {
            schema: { type: "string" },
            description: "Rotates and sets new accessToken and refreshToken cookies",
          },
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
                        id: { type: "integer", example: 1 },
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", example: "john.doe@example.com" },
                        role: { type: "string", example: "USER" },
                        isActive: { type: "boolean", example: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      401: { description: "Invalid or expired refresh token cookie" },
    },
  },
};
