import type { Server as SocketIOServer, Socket } from "socket.io";
import { socketAuthMiddleware } from "./socket-auth.middleware.ts";
import { logger } from "../../app/common/utils/logger.util.ts";

export const registerNotificationSocket = (io: SocketIOServer) => {
  const nsp = io.of("/notifications");

  nsp.use(socketAuthMiddleware);

  nsp.on("connection", (socket: Socket) => {
    const userId = socket.data.userId;

    // Auto-join personal notification channel
    socket.join(`user:${userId}`);

    logger.info(`Socket connected: user ${userId} on /notifications`);

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: user ${userId} from /notifications`);
    });
  });
};