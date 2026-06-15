import type { Server as SocketIOServer, Socket } from "socket.io";
import { socketAuthMiddleware } from "./socket-auth.middleware.ts";
import { ChatService } from "../../app/modules/chat/chat.service.ts";
import { logger } from "../../app/common/utils/logger.util.ts";

const conversationRoom = (conversationId: number) => `chat:conversation:${conversationId}`;

export const registerChatSocket = (io: SocketIOServer) => {
  const nsp = io.of("/chat");

  nsp.use(socketAuthMiddleware);

  nsp.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as number;
    logger.info(`Socket connected: user ${userId} on /chat`);

    ChatService.setUserOnline(userId).catch(() => {});

    socket.on("chat:join", async (payload: { conversationId: number }, ack?: (res: unknown) => void) => {
      try {
        const { conversationId } = payload;
        if (!conversationId) throw new Error("conversationId is required");

        const conversation = await ChatService.getConversationById(conversationId, userId);
        await socket.join(conversationRoom(conversationId));
        await ChatService.markDelivered(conversationId, userId);

        const result = await ChatService.getMessages(conversationId, userId, undefined, 50);
        ack?.({ success: true, data: { conversation, ...result } });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to join conversation";
        ack?.({ success: false, message });
      }
    });

    socket.on(
      "chat:send",
      async (payload: { conversationId: number; text: string }, ack?: (res: unknown) => void) => {
        try {
          const { conversationId, text } = payload;
          if (!conversationId || !text?.trim()) {
            throw new Error("conversationId and text are required");
          }

          const result = await ChatService.sendMessage(userId, {
            conversationId,
            text: text.trim(),
          });

          nsp.to(conversationRoom(result.conversationId)).emit("chat:message", result.message);

          io.of("/notifications").to(`user:${result.receiverId}`).emit("notification:new", {
            type: "new_message",
            message: `New message from ${socket.data.email}`,
            senderId: userId,
            conversationId: result.conversationId,
          });

          ack?.({ success: true, data: result.message });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to send message";
          ack?.({ success: false, message });
        }
      }
    );

    socket.on("chat:typing", (payload: { conversationId: number; isTyping: boolean }) => {
      socket
        .to(conversationRoom(payload.conversationId))
        .emit("chat:typing", { userId, isTyping: payload.isTyping });
    });

    socket.on("disconnect", () => {
      ChatService.setUserOffline(userId).catch(() => {});
      logger.info(`Socket disconnected: user ${userId} from /chat`);
    });
  });
};
