import { Router } from "express";
import { ChatController } from "./chat.controller.ts";
import { protect } from "../../common/guards/auth.middleware.ts";
import { validateDto } from "../../common/guards/validate-dto.middleware.ts";
import {
  startConversationDtoSchema,
  sendMessageDtoSchema,
  markReadDtoSchema,
  reportUserDtoSchema,
} from "./dto/chat.dto.ts";

const router = Router();
const controller = new ChatController();

router.post("/conversations/start", protect, validateDto(startConversationDtoSchema), (req, res, next) => controller.startConversation(req, res, next));
router.get("/conversations", protect, (req, res, next) => controller.getConversations(req, res, next));
router.get("/conversations/:id", protect, (req, res, next) => controller.getConversationById(req, res, next));
router.delete("/conversations/:id", protect, (req, res, next) => controller.deleteConversation(req, res, next));

router.post("/messages", protect, validateDto(sendMessageDtoSchema), (req, res, next) => controller.sendMessage(req, res, next));
router.get("/messages/unread-count", protect, (req, res, next) => controller.getUnreadCount(req, res, next));
router.get("/messages/:conversationId", protect, (req, res, next) => controller.getMessages(req, res, next));
router.patch("/messages/read", protect, validateDto(markReadDtoSchema), (req, res, next) => controller.markRead(req, res, next));

router.post("/reports/user", protect, validateDto(reportUserDtoSchema), (req, res, next) => controller.reportUser(req, res, next));

export default router;