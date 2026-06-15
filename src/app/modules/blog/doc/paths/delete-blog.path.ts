export const deleteBlogPath = {
  delete: {
    summary: "Delete blog post",
    description: "Delete own blog post or any post as admin.",
    tags: ["Blogs"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    responses: {
      200: { description: "Blog post deleted successfully" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Blog post not found" },
    },
  },
};
