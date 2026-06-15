export const listBlogsPath = {
  get: {
    summary: "List blog posts",
    description: "Public paginated list of published blogs. Admins see all posts when authenticated.",
    tags: ["Blogs"],
    parameters: [
      { name: "page", in: "query", schema: { type: "integer", example: 1 } },
      { name: "limit", in: "query", schema: { type: "integer", example: 10 } },
      { name: "tag", in: "query", schema: { type: "string", example: "watches" } },
      { name: "authorId", in: "query", schema: { type: "integer" } },
      { name: "search", in: "query", schema: { type: "string" } },
      {
        name: "isPublished",
        in: "query",
        description: "Admin only — filter by publish status",
        schema: { type: "boolean" },
      },
    ],
    responses: {
      200: { description: "Blogs retrieved successfully" },
    },
  },
};
