import { prisma } from "../../../config/db/database.config.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { MESSAGES } from "../../common/constants/messages.constants.ts";
import { AppError } from "../../common/exceptions/app-error.exception.ts";
import type { CreateAnnouncementDto, UpdateAnnouncementDto } from "./interfaces/announcement.interface.ts";

const authorInclude = {
  author: { select: { id: true, name: true, photo: true } },
} as const;

export class AnnouncementService {
  static async create(authorId: number, dto: CreateAnnouncementDto) {
    return prisma.announcement.create({
      data: {
        userId: authorId,
        title: dto.title,
        content: dto.content,
        image: dto.image ?? null,
        date: dto.date ? new Date(dto.date) : null,
        isActive: dto.isActive ?? true,
      },
      include: authorInclude,
    });
  }

  static async update(id: number, dto: UpdateAnnouncementDto) {
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new AppError(MESSAGES.ANNOUNCEMENT.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    return prisma.announcement.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.content && { content: dto.content }),
        ...(dto.image !== undefined && { image: dto.image }),
        ...(dto.date !== undefined && { date: dto.date ? new Date(dto.date) : null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: authorInclude,
    });
  }

  static async delete(id: number) {
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new AppError(MESSAGES.ANNOUNCEMENT.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    await prisma.announcement.delete({ where: { id } });
  }

  static async list(page = 1, limit = 10, isAdmin = false) {
    const skip = (page - 1) * limit;
    const where = isAdmin ? {} : { isActive: true };

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: authorInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.announcement.count({ where }),
    ]);

    return { announcements, total, page, limit };
  }

  static async getById(id: number, isAdmin = false) {
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: authorInclude,
    });

    if (!announcement || (!isAdmin && !announcement.isActive)) {
      throw new AppError(MESSAGES.ANNOUNCEMENT.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    return announcement;
  }

  static async getActive(limit = 5) {
    return prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
