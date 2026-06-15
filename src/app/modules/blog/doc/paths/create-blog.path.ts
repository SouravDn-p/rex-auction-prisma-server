export const createBlogPath = {
  post: {
    summary: "Create blog post",
    description: "Seller or admin creates a new blog post (starts as draft). Images are uploaded as multipart files and stored on Cloudinary.",
    tags: ["Blogs"],
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            required: ["title", "fullContent", "images"],
            properties: {
              title: { type: "string", example: "How to Spot a Vintage Rolex" },
              excerpt: { type: "string", example: "A quick guide for collectors." },
              fullContent: { type: "string", example: "Detailed article content with at least 50 characters..." },
              tags: {
                type: "string",
                description: 'JSON array or comma-separated tags, e.g. ["watches","vintage"]',
                example: '["watches","vintage"]',
              },
              images: {
                type: "array",
                items: { type: "string", format: "binary" },
                description: "1–5 image files",
              },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Blog post created successfully" },
      400: { description: "Validation error or missing images" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — seller or admin role required" },
    },
  },
};
