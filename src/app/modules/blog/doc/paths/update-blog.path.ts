export const updateBlogPath = {
  patch: {
    summary: "Update blog post",
    description: "Update own blog post (or any post as admin). New images replace existing ones only when files are uploaded.",
    tags: ["Blogs"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              excerpt: { type: "string" },
              fullContent: { type: "string" },
              tags: { type: "string", description: "JSON array or comma-separated tags" },
              images: {
                type: "array",
                items: { type: "string", format: "binary" },
                description: "Optional — up to 5 new images",
              },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Blog post updated successfully" },
      400: { description: "Validation error" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Blog post not found" },
    },
  },
};
