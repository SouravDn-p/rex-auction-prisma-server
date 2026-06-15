export const adminRevenuePath = {
  get: {
    summary: "Admin — revenue summary",
    description: "Platform revenue totals and monthly breakdown.",
    tags: ["Payments"],
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: "Revenue summary retrieved" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — admin only" },
    },
  },
};
