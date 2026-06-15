import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/interceptors/response.util.ts';
import { HTTP_STATUS } from '../../common/constants/http-status.constants.ts';
import { MESSAGES } from '../../common/constants/messages.constants.ts';
import { uploadSingleImage } from '../../common/utils/upload.util.ts';
import { AnnouncementService } from './announcements.service.ts';

export class AnnouncementController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { userId: number };
      const image = await uploadSingleImage(req.file, 'announcements');
      const announcement = await AnnouncementService.create(user.userId, {
        ...req.body,
        image,
      });
      sendSuccess(res, HTTP_STATUS.CREATED, MESSAGES.ANNOUNCEMENT.CREATED, { announcement });
    } catch (e) { next(e); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = { ...req.body };

      if (req.file) {
        payload.image = await uploadSingleImage(req.file, 'announcements');
      }

      const announcement = await AnnouncementService.update(Number(req.params.id), payload);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.ANNOUNCEMENT.UPDATED, { announcement });
    } catch (e) { next(e); }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await AnnouncementService.delete(Number(req.params.id));
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.ANNOUNCEMENT.DELETED);
    } catch (e) { next(e); }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { role?: string } | undefined;
      const isAdmin = user?.role === 'ADMIN';
      const result = await AnnouncementService.list(
        req.query.page ? Number(req.query.page) : undefined,
        req.query.limit ? Number(req.query.limit) : undefined,
        isAdmin
      );
      sendSuccess(res, HTTP_STATUS.OK, 'Announcements retrieved successfully', result);
    } catch (e) { next(e); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as { role?: string } | undefined;
      const isAdmin = user?.role === 'ADMIN';
      const announcement = await AnnouncementService.getById(Number(req.params.id), isAdmin);
      sendSuccess(res, HTTP_STATUS.OK, 'Announcement retrieved', { announcement });
    } catch (e) { next(e); }
  }

  async getActive(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const announcements = await AnnouncementService.getActive();
      sendSuccess(res, HTTP_STATUS.OK, 'Active announcements retrieved', { announcements });
    } catch (e) { next(e); }
  }
}
