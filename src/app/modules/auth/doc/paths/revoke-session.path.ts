export const revokeSessionPath = {
  delete: {
    summary: "Revoke a specific session",
    description: "Invalidate a single refresh-token session by ID.",
    tags: ["Auth"],
    security: [{ cookieAuth: [] }],
    parameters: [
      {
        name: "sessionId",
        in: "path",
        required: true,
        schema: { type: "integer" },
        description: "Session (UserToken) ID to revoke",
      },
    ],
    responses: {
      200: { description: "Session revoked successfully" },
      401: { description: "Unauthorized" },
    },
  },
};
