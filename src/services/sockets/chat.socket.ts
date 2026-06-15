import type { Server as SocketIOServer, Socket } from "socket.io";
import { socketAuthMiddleware } from "./socket-auth.middleware.ts";
import { prisma } from "../../config/db/database.config.ts";
import { logger } from "../../app/common/utils/logger.util.ts";
// Deterministic room ID for a pair of users (order-independent)
const conversationRoom = (userIdA: number, userIdB: number) => {
  const [a, b] = [userIdA, userIdB].sort((x, y) => x - y);
  return `chat:${a}:${b}`;
};

export const registerChatSocket = (io: SocketIOServer) => {
  const nsp = io.of("/chat");

  nsp.use(socketAuthMiddleware);

  nsp.on("connection", (socket: Socket) => {
    const userId = socket.data.userId;
    logger.info(`Socket connected: user ${userId} on /chat`);

    // ─── Join a 1:1 conversation ───
    socket.on("chat:join", async (payload: { otherUserId: number }, ack?: (res: any) => void) => {
      try {
        const { otherUserId } = payload;
        if (!otherUserId) throw new Error("otherUserId is required");

        await socket.join(conversationRoom(userId, otherUserId));

        // Mark messages from otherUser as read
        await prisma.message.updateMany({
          where: { senderId: otherUserId, receiverId: userId, isRead: false },
          data: { isRead: true },
        });

        const history = await prisma.message.findMany({
          where: {
            OR: [
              { senderId: userId, receiverId: otherUserId },
              { senderId: otherUserId, receiverId: userId },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        });

        ack?.({ success: true, data: { history: history.reverse() } });
      } catch (error: any) {
        ack?.({ success: false, message: error.message });
      }
    });

    // ─── Send message ───
    socket.on(
      "chat:send",
      async (payload: { receiverId: number; text: string }, ack?: (res: any) => void) => {
        try {
          const { receiverId, text } = payload;
          if (!receiverId || !text?.trim()) throw new Error("receiverId and text are required");

          const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
          if (!receiver) throw new Error("Recipient not found");

          const message = await prisma.message.create({
            data: { senderId: userId, receiverId, text: text.trim() },
          });

          const roomName = conversationRoom(userId, receiverId);

          nsp.to(roomName).emit("chat:message", message);

          // Also notify receiver's notification namespace if they're not in the chat room
          io.of("/notifications").to(`user:${receiverId}`).emit("notification:new", {
            type: "new_message",
            message: `New message from ${socket.data.email}`,
            senderId: userId,
          });

          ack?.({ success: true, data: message });
        } catch (error: any) {
          ack?.({ success: false, message: error.message });
        }
      }
    );

    // ─── Typing indicator ───
    socket.on("chat:typing", (payload: { otherUserId: number; isTyping: boolean }) => {
      const roomName = conversationRoom(userId, payload.otherUserId);
      socket.to(roomName).emit("chat:typing", { userId, isTyping: payload.isTyping });
    });

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: user ${userId} from /chat`);
    });
  });
};