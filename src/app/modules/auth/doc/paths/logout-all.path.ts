export const logoutAllPath = {
  post: {
    summary: "Logout from all devices",
    description:
      "Revokes all refresh tokens for the authenticated user and clears auth cookies.",
    tags: ["Auth"],
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Logged out from all devices",
        headers: {
          "Set-Cookie": {
            schema: { type: "string" },
            description: "Clears accessToken and refreshToken cookies",
          },
        },
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                message: { type: "string", example: "Logged out from all devices" },
              },
            },
          },
        },
      },
      401: { description: "Unauthorized" },
    },
  },
};
