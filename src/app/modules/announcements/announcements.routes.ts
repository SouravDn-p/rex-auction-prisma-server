import { Router } from 'express';
import { AnnouncementController } from './announcements.controller.ts';
import { protect, restrictTo, optionalProtect } from '../../common/guards/auth.middleware.ts';
import { validateFormDto } from '../../common/guards/validate-dto.middleware.ts';
import { upload } from '../../common/middlewares/upload.ts';
import { createAnnouncementDtoSchema, updateAnnouncementDtoSchema } from './dto/announcement.dto.ts';

const router = Router();
const controller = new AnnouncementController();

// Public (optional auth for admin-aware reads)
router.get('/', optionalProtect, (req, res, next) => controller.list(req, res, next));
router.get('/active', (_req, res, next) => controller.getActive(_req, res, next));
router.get('/:id', optionalProtect, (req, res, next) => controller.getById(req, res, next));

// Admin only
router.post(
  '/',
  protect,
  restrictTo('ADMIN'),
  upload.single('image'),
  validateFormDto(createAnnouncementDtoSchema),
  (req, res, next) => controller.create(req, res, next)
);
router.patch(
  '/:id',
  protect,
  restrictTo('ADMIN'),
  upload.single('image'),
  validateFormDto(updateAnnouncementDtoSchema),
  (req, res, next) => controller.update(req, res, next)
);
router.delete('/:id', protect, restrictTo('ADMIN'), (req, res, next) => controller.remove(req, res, next));

export default router;
