import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/interceptors/response.util.ts';
import { HTTP_STATUS } from '../../common/constants/http-status.constants.ts';
import { MESSAGES } from '../../common/constants/messages.constants.ts';
import { AppError } from '../../common/exceptions/app-error.exception.ts';
import { uploadImages } from '../../common/utils/upload.util.ts';
import { BlogService } from './blog.service.ts';
import type { ListBlogsQuery, GetBlogOptions } from './interfaces/blog.interface.ts';

const getParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
};

export class BlogController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { userId: number };
      const files = req.files as Express.Multer.File[] | undefined;

      if (!files?.length) {
        throw new AppError('At least one image is required', HTTP_STATUS.BAD_REQUEST);
      }

      const imageUrls = await uploadImages(files, 'blogs');
      const blog = await BlogService.create(user.userId, { ...req.body, imageUrls });
      sendSuccess(res, HTTP_STATUS.CREATED, MESSAGES.BLOG.CREATED, { blog });
    } catch (e) { next(e); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { userId: number; role: string };
      const files = req.files as Express.Multer.File[] | undefined;
      const payload = { ...req.body };

      if (files?.length) {
        payload.imageUrls = await uploadImages(files, 'blogs');
      }

      const blog = await BlogService.update(
        Number(req.params.id),
        user.userId,
        payload,
        user.role === 'ADMIN'
      );
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.BLOG.UPDATED, { blog });
    } catch (e) { next(e); }
  }

  async publish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const blog = await BlogService.setPublished(Number(req.params.id), true);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.BLOG.PUBLISHED, { blog });
    } catch (e) { next(e); }
  }

  async unpublish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const blog = await BlogService.setPublished(Number(req.params.id), false);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.BLOG.UNPUBLISHED, { blog });
    } catch (e) { next(e); }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { userId: number; role: string };
      await BlogService.delete(Number(req.params.id), user.userId, user.role === 'ADMIN');
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.BLOG.DELETED);
    } catch (e) { next(e); }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { role?: string } | undefined;
      const isAdmin = user?.role === 'ADMIN';
      const query: ListBlogsQuery = {};

      if (req.query.page) query.page = Number(req.query.page);
      if (req.query.limit) query.limit = Number(req.query.limit);
      if (req.query.tag) query.tag = String(req.query.tag);
      if (req.query.authorId) query.authorId = Number(req.query.authorId);
      if (req.query.search) query.search = String(req.query.search);
      if (req.query.isPublished !== undefined) {
        query.isPublished = req.query.isPublished === 'true';
      }

      const result = await BlogService.list(query, isAdmin);
      sendSuccess(res, HTTP_STATUS.OK, 'Blogs retrieved successfully', result);
    } catch (e) { next(e); }
  }

  async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const blog = await BlogService.getBySlug(getParam(req.params.slug));
      sendSuccess(res, HTTP_STATUS.OK, 'Blog retrieved successfully', { blog });
    } catch (e) { next(e); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { userId?: number; role?: string } | undefined;
      const options: GetBlogOptions = { isAdmin: user?.role === 'ADMIN' };
      if (user?.userId !== undefined) {
        options.authorId = user.userId;
      }

      const blog = await BlogService.getById(Number(req.params.id), options);
      sendSuccess(res, HTTP_STATUS.OK, 'Blog retrieved successfully', { blog });
    } catch (e) { next(e); }
  }

  async getMyBlogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { userId: number };
      const result = await BlogService.getMyBlogs(
        user.userId,
        req.query.page ? Number(req.query.page) : undefined,
        req.query.limit ? Number(req.query.limit) : undefined
      );
      sendSuccess(res, HTTP_STATUS.OK, 'Your blogs retrieved successfully', result);
    } catch (e) { next(e); }
  }

  async getTags(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tags = await BlogService.getAllTags();
      sendSuccess(res, HTTP_STATUS.OK, 'Tags retrieved successfully', { tags });
    } catch (e) { next(e); }
  }
}
