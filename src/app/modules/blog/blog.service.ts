import { prisma } from "../../../config/db/database.config.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { MESSAGES } from "../../common/constants/messages.constants.ts";
import { AppError } from "../../common/exceptions/app-error.exception.ts";
import type { CreateBlogDto, UpdateBlogDto, ListBlogsQuery, GetBlogOptions } from "./interfaces/blog.interface.ts";

const slugify = (title: string): string =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const generateSlug = (title: string): string => `${slugify(title)}-${Date.now()}`;

const blogInclude = {
  author: { select: { id: true, name: true, photo: true } },
  tags: true,
} as const;

export class BlogService {
  static async create(authorId: number, dto: CreateBlogDto) {
    const slug = generateSlug(dto.title);

    return prisma.$transaction(async (tx) => {
      const blog = await tx.blog.create({
        data: {
          title: dto.title,
          slug,
          authorId,
          imageUrls: dto.imageUrls,
          excerpt: dto.excerpt ?? null,
          fullContent: dto.fullContent,
          isPublished: false,
        },
        include: blogInclude,
      });

      if (dto.tags && dto.tags.length > 0) {
        await tx.blogTag.createMany({
          data: dto.tags.map((tag) => ({ blogId: blog.id, tag: tag.toLowerCase() })),
        });
      }

      return tx.blog.findUnique({
        where: { id: blog.id },
        include: blogInclude,
      });
    });
  }

  static async update(blogId: number, authorId: number, dto: UpdateBlogDto, isAdmin = false) {
    const blog = await prisma.blog.findUnique({ where: { id: blogId } });
    if (!blog) throw new AppError(MESSAGES.BLOG.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    if (!isAdmin && blog.authorId !== authorId) throw new AppError(MESSAGES.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN);

    return prisma.$transaction(async (tx) => {
      await tx.blog.update({
        where: { id: blogId },
        data: {
          ...(dto.title && { title: dto.title, slug: `${slugify(dto.title)}-${blogId}` }),
          ...(dto.imageUrls && { imageUrls: dto.imageUrls }),
          ...(dto.excerpt !== undefined && { excerpt: dto.excerpt }),
          ...(dto.fullContent && { fullContent: dto.fullContent }),
        },
      });

      if (dto.tags !== undefined) {
        await tx.blogTag.deleteMany({ where: { blogId } });
        if (dto.tags.length > 0) {
          await tx.blogTag.createMany({
            data: dto.tags.map((tag) => ({ blogId, tag: tag.toLowerCase() })),
          });
        }
      }

      return tx.blog.findUnique({
        where: { id: blogId },
        include: blogInclude,
      });
    });
  }

  static async setPublished(blogId: number, isPublished: boolean) {
    const blog = await prisma.blog.findUnique({ where: { id: blogId } });
    if (!blog) throw new AppError(MESSAGES.BLOG.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    return prisma.blog.update({
      where: { id: blogId },
      data: { isPublished },
      include: blogInclude,
    });
  }

  static async delete(blogId: number, authorId: number, isAdmin = false) {
    const blog = await prisma.blog.findUnique({ where: { id: blogId } });
    if (!blog) throw new AppError(MESSAGES.BLOG.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    if (!isAdmin && blog.authorId !== authorId) throw new AppError(MESSAGES.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN);

    await prisma.$transaction([
      prisma.blogTag.deleteMany({ where: { blogId } }),
      prisma.blog.delete({ where: { id: blogId } }),
    ]);
  }

  static async list(query: ListBlogsQuery, isAdmin = false) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (!isAdmin) where.isPublished = true;
    else if (query.isPublished !== undefined) where.isPublished = query.isPublished;
    if (query.authorId) where.authorId = query.authorId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { excerpt: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.tag) {
      where.tags = { some: { tag: query.tag.toLowerCase() } };
    }

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        include: blogInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.blog.count({ where }),
    ]);

    return { blogs, total, page, limit };
  }

  static async getBySlug(slug: string) {
    const blog = await prisma.blog.findUnique({
      where: { slug },
      include: blogInclude,
    });
    if (!blog || !blog.isPublished) {
      throw new AppError(MESSAGES.BLOG.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    prisma.blog.update({ where: { id: blog.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

    return blog;
  }

  static async getById(blogId: number, options: GetBlogOptions = {}) {
    const blog = await prisma.blog.findUnique({
      where: { id: blogId },
      include: blogInclude,
    });

    const canViewDraft =
      options.isAdmin || (options.authorId !== undefined && blog?.authorId === options.authorId);

    if (!blog || (!canViewDraft && !blog.isPublished)) {
      throw new AppError(MESSAGES.BLOG.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    return blog;
  }

  static async getMyBlogs(authorId: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where: { authorId },
        include: { tags: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.blog.count({ where: { authorId } }),
    ]);
    return { blogs, total, page, limit };
  }

  static async getAllTags() {
    const tags = await prisma.blogTag.groupBy({
      by: ['tag'],
      _count: { tag: true },
      orderBy: { _count: { tag: 'desc' } },
      take: 50,
    });
    return tags.map((t) => ({ tag: t.tag, count: t._count.tag }));
  }
}
