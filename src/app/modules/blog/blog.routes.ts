import { Router } from 'express';
import { BlogController } from './blog.controller.ts';
import { protect, restrictTo, optionalProtect } from '../../common/guards/auth.middleware.ts';
import { validateFormDto } from '../../common/guards/validate-dto.middleware.ts';
import { upload } from '../../common/middlewares/upload.ts';
import { createBlogDtoSchema, updateBlogDtoSchema } from './dto/blog.dto.ts';

const router = Router();
const controller = new BlogController();

// Public (optional auth for admin/seller-aware reads)
router.get('/', optionalProtect, (req, res, next) => controller.list(req, res, next));
router.get('/tags', (_req, res, next) => controller.getTags(_req, res, next));
router.get('/slug/:slug', (req, res, next) => controller.getBySlug(req, res, next));
router.get('/me/blogs', protect, restrictTo('SELLER', 'ADMIN'), (req, res, next) => controller.getMyBlogs(req, res, next));
router.get('/:id', optionalProtect, (req, res, next) => controller.getById(req, res, next));

// Seller / Admin
router.post(
  '/',
  protect,
  restrictTo('SELLER', 'ADMIN'),
  upload.array('images', 5),
  validateFormDto(createBlogDtoSchema),
  (req, res, next) => controller.create(req, res, next)
);
router.patch(
  '/:id',
  protect,
  restrictTo('SELLER', 'ADMIN'),
  upload.array('images', 5),
  validateFormDto(updateBlogDtoSchema),
  (req, res, next) => controller.update(req, res, next)
);
router.delete('/:id', protect, restrictTo('SELLER', 'ADMIN'), (req, res, next) => controller.remove(req, res, next));

// Admin only
router.patch('/:id/publish', protect, restrictTo('ADMIN'), (req, res, next) => controller.publish(req, res, next));
router.patch('/:id/unpublish', protect, restrictTo('ADMIN'), (req, res, next) => controller.unpublish(req, res, next));

export default router;
