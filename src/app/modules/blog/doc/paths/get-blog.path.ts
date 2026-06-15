export const getBlogPath = {
  get: {
    summary: "Get blog post by ID",
    description: "Fetch a blog post. Authors and admins can view drafts.",
    tags: ["Blogs"],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    responses: {
      200: { description: "Blog retrieved successfully" },
      404: { description: "Blog post not found" },
    },
  },
};
