import type { Socket } from "socket.io";
import { verifyAccessToken } from "../../app/common/utils/jwt.util.ts";
import { prisma } from "../../config/db/database.config.ts";
import { redisConnection } from "../../config/redis/redis.config.ts";

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: number;
    email: string;
    role: string;
  };
}

const USER_CACHE_TTL_SEC = 60;

export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    // Token from handshake auth payload or cookie
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = verifyAccessToken(token);

    const cacheKey = `user:auth:${decoded.userId}`;
    let user: { id: number; email: string; role: string; isActive: boolean } | null = null;

    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      user = JSON.parse(cached);
    } else {
      const dbUser = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true, isActive: true },
      });
      if (dbUser) {
        user = dbUser;
        await redisConnection.set(cacheKey, JSON.stringify(dbUser), "EX", USER_CACHE_TTL_SEC);
      }
    }

    if (!user || !user.isActive) {
      return next(new Error("Unauthorized"));
    }

    socket.data.userId = user.id;
    socket.data.email = user.email;
    socket.data.role = user.role;

    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
};