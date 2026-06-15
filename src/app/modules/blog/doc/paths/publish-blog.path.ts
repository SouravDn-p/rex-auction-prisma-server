export const publishBlogPath = {
  patch: {
    summary: "Publish blog post",
    description: "Admin publishes a draft blog post.",
    tags: ["Blogs"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    responses: {
      200: { description: "Blog post published successfully" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — admin role required" },
      404: { description: "Blog post not found" },
    },
  },
};
