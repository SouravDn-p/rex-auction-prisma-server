export const googleCallbackPath = {
  get: {
    summary: "Google authentication callback",
    description:
      "Handles Google OAuth callback, creates user session/tokens, and redirects or returns user data.",
    tags: ["Auth"],
    parameters: [
      {
        name: "code",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "Authorization code returned by Google",
      },
      {
        name: "state",
        in: "query",
        required: false,
        schema: {
          type: "string",
        },
        description: "State parameter for security validation",
      },
    ],
    responses: {
      302: {
        description:
          "Redirects user to dashboard after successful authentication",
      },
      200: {
        description: "Google login successful (if API response mode is used)",
        headers: {
          "Set-Cookie": {
            schema: {
              type: "string",
              example:
                "accessToken=xxx; HttpOnly; Secure; SameSite=Lax; refreshToken=yyy; HttpOnly; Secure; SameSite=Lax",
            },
            description:
              "Sets authentication cookies (access + refresh token)",
          },
        },
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: {
                  type: "boolean",
                  example: true,
                },
                message: {
                  type: "string",
                  example: "Google login successful",
                },
                data: {
                  type: "object",
                  properties: {
                    user: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          example: "google_123456",
                        },
                        name: {
                          type: "string",
                          example: "John Doe",
                        },
                        email: {
                          type: "string",
                          example: "john@gmail.com",
                        },
                        avatar: {
                          type: "string",
                          example:
                            "https://lh3.googleusercontent.com/a/...",
                        },
                        role: {
                          type: "string",
                          example: "user",
                        },
                      },
                    },
                    accessToken: {
                      type: "string",
                      example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    },
                  },
                },
              },
            },
          },
        },
      },
      401: {
        description: "Google authentication failed",
      },
    },
  },
};