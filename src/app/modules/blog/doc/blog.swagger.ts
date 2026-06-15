import { blogTagsPath } from "./paths/blog-tags.path.ts";
import { createBlogPath } from "./paths/create-blog.path.ts";
import { deleteBlogPath } from "./paths/delete-blog.path.ts";
import { getBlogBySlugPath } from "./paths/get-blog-by-slug.path.ts";
import { getBlogPath } from "./paths/get-blog.path.ts";
import { listBlogsPath } from "./paths/list-blogs.path.ts";
import { myBlogsPath } from "./paths/my-blogs.path.ts";
import { publishBlogPath } from "./paths/publish-blog.path.ts";
import { unpublishBlogPath } from "./paths/unpublish-blog.path.ts";
import { updateBlogPath } from "./paths/update-blog.path.ts";

export const blogPaths = {
  "/blogs": {
    ...listBlogsPath,
    ...createBlogPath,
  },
  "/blogs/tags": blogTagsPath,
  "/blogs/slug/{slug}": getBlogBySlugPath,
  "/blogs/me/blogs": myBlogsPath,
  "/blogs/{id}": {
    ...getBlogPath,
    ...updateBlogPath,
    ...deleteBlogPath,
  },
  "/blogs/{id}/publish": publishBlogPath,
  "/blogs/{id}/unpublish": unpublishBlogPath,
};
