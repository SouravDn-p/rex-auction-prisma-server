export const googleAuthPath = {
  get: {
    summary: "Start Google authentication",
    description:
      "Redirect user to Google OAuth consent screen for authentication.",
    tags: ["Auth"],
    responses: {
      302: {
        description:
          "Redirects user to Google authentication page",
      },
    },
  },
};