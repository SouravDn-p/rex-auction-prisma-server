export const googleCallbackPath = {
  get: {
    summary: "Google authentication callback",
    description:
      "Handles Google OAuth callback, sets auth cookies, and redirects to the frontend. Tokens are never returned in JSON.",
    tags: ["Auth"],
    parameters: [
      {
        name: "code",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "Authorization code returned by Google",
      },
      {
        name: "state",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "State parameter for security validation",
      },
    ],
    responses: {
      302: {
        description:
          "Redirects to frontend with auth cookies set (accessToken + refreshToken HttpOnly)",
        headers: {
          "Set-Cookie": {
            schema: {
              type: "string",
              example:
                "accessToken=xxx; HttpOnly; Secure; SameSite=Lax; refreshToken=yyy; HttpOnly; Secure; SameSite=Lax",
            },
            description: "Sets authentication cookies",
          },
        },
      },
      401: { description: "Google authentication failed — redirects to login with error" },
    },
  },
};
