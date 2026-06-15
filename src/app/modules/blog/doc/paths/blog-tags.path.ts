export const blogTagsPath = {
  get: {
    summary: "List blog tags",
    description: "Returns popular tags with post counts for filtering.",
    tags: ["Blogs"],
    responses: {
      200: { description: "Tags retrieved successfully" },
    },
  },
};
