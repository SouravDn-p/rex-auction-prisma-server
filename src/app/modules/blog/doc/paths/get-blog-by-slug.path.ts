export const getBlogBySlugPath = {
  get: {
    summary: "Get blog post by slug",
    description: "Fetch a published blog post by its URL slug. Increments view count.",
    tags: ["Blogs"],
    parameters: [
      { name: "slug", in: "path", required: true, schema: { type: "string", example: "how-to-spot-a-vintage-rolex-1718450000000" } },
    ],
    responses: {
      200: { description: "Blog retrieved successfully" },
      404: { description: "Blog post not found" },
    },
  },
};
