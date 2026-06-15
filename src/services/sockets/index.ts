import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { ENV } from "../../config/env.config.ts";
import { registerAuctionSocket } from "./auction.socket.ts";
import { registerChatSocket } from "./chat.socket.ts";
import { registerNotificationSocket } from "./notification.socket.ts";
import { logger } from "../../app/common/utils/logger.util.ts";

let io: SocketIOServer;

export const initSocketIO = (server: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: ENV.ALLOWED_ORIGINS,
      credentials: true,
    },
  });

  registerAuctionSocket(io);
  registerChatSocket(io);
  registerNotificationSocket(io);

  logger.info("Socket.io initialized");
  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};