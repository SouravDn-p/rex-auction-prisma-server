export const unpublishBlogPath = {
  patch: {
    summary: "Unpublish blog post",
    description: "Admin unpublishes a blog post back to draft.",
    tags: ["Blogs"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    responses: {
      200: { description: "Blog post unpublished successfully" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — admin role required" },
      404: { description: "Blog post not found" },
    },
  },
};
