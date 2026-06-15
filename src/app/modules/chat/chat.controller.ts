import type { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../common/interceptors/response.util.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { MESSAGES } from "../../common/constants/messages.constants.ts";
import { ChatService } from "./chat.service.ts";

export class ChatController {
  async startConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const conversation = await ChatService.findOrCreateConversation(user.userId, req.body);
      sendSuccess(res, HTTP_STATUS.OK, "Conversation ready", { conversation });
    } catch (error) {
      next(error);
    }
  }

  async getConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const conversations = await ChatService.getConversationList(user.userId);
      sendSuccess(res, HTTP_STATUS.OK, "Conversations retrieved successfully", { conversations });
    } catch (error) {
      next(error);
    }
  }

  async getConversationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const conversationId = Number(req.params.id);
      const conversation = await ChatService.getConversationById(conversationId, user.userId);
      sendSuccess(res, HTTP_STATUS.OK, "Conversation retrieved successfully", { conversation });
    } catch (error) {
      next(error);
    }
  }

  async deleteConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const conversationId = Number(req.params.id);
      await ChatService.deleteConversation(conversationId, user.userId);
      sendSuccess(res, HTTP_STATUS.OK, MESSAGES.CHAT.CONVERSATION_DELETED);
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const result = await ChatService.sendMessage(user.userId, req.body);
      sendSuccess(res, HTTP_STATUS.CREATED, MESSAGES.CHAT.MESSAGE_SENT, { message: result.message });
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const conversationId = Number(req.params.conversationId);
      const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 30;

      const result = await ChatService.getMessages(conversationId, user.userId, cursor, limit);
      sendSuccess(res, HTTP_STATUS.OK, "Messages retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const result = await ChatService.markAsRead(req.body.conversationId, user.userId);
      sendSuccess(res, HTTP_STATUS.OK, "Messages marked as read", { updatedCount: result.updatedCount });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const result = await ChatService.getUnreadCount(user.userId);
      sendSuccess(res, HTTP_STATUS.OK, "Unread count retrieved", result);
    } catch (error) {
      next(error);
    }
  }

  async reportUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const report = await ChatService.reportUser(user.userId, req.body);
      sendSuccess(res, HTTP_STATUS.CREATED, MESSAGES.CHAT.USER_REPORTED, { report });
    } catch (error) {
      next(error);
    }
  }
}