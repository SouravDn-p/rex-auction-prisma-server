export const myBlogsPath = {
  get: {
    summary: "Get my blog posts",
    description: "Seller or admin retrieves their own blogs including drafts.",
    tags: ["Blogs"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "page", in: "query", schema: { type: "integer", example: 1 } },
      { name: "limit", in: "query", schema: { type: "integer", example: 10 } },
    ],
    responses: {
      200: { description: "Your blogs retrieved successfully" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — seller or admin role required" },
    },
  },
};
