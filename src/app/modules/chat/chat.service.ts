import { prisma } from "../../../config/db/database.config.ts";
import { redisConnection } from "../../../config/redis/redis.config.ts";
import { HTTP_STATUS } from "../../common/constants/http-status.constants.ts";
import { MESSAGES } from "../../common/constants/messages.constants.ts";
import { AppError } from "../../common/exceptions/app-error.exception.ts";
import type {
  StartConversationDto,
  SendMessageDto,
  ReportUserDto,
  ConversationListItem,
} from "./interfaces/chat.interface.ts";

const ONLINE_SET_KEY = "presence:online";

// Canonical ordering ensures @@unique([userOneId, userTwoId]) prevents duplicates
const orderUserIds = (a: number, b: number): [number, number] => (a < b ? [a, b] : [b, a]);

export class ChatService {
  // ─────────────────────────────────────────────────────────
  // Find or create a conversation (does NOT create until first message
  // is sent — but exposed here for "start conversation" UX which can
  // pre-fetch/create an empty shell, per requirement #1)
  // ─────────────────────────────────────────────────────────
  static async findOrCreateConversation(userId: number, dto: StartConversationDto) {
    if (userId === dto.otherUserId) {
      throw new AppError(MESSAGES.CHAT.CANNOT_MESSAGE_SELF, HTTP_STATUS.BAD_REQUEST);
    }

    const otherUser = await prisma.user.findUnique({ where: { id: dto.otherUserId } });
    if (!otherUser) {
      throw new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const [userOneId, userTwoId] = orderUserIds(userId, dto.otherUserId);

    const existing = await prisma.conversation.findUnique({
      where: { userOneId_userTwoId: { userOneId, userTwoId } },
    });

    if (existing) {
      // Un-delete for this user if they had soft-deleted it previously
      const isUserOne = userId === userOneId;
      if ((isUserOne && existing.deletedByUserOne) || (!isUserOne && existing.deletedByUserTwo)) {
        await prisma.conversation.update({
          where: { id: existing.id },
          data: isUserOne ? { deletedByUserOne: false } : { deletedByUserTwo: false },
        });
      }
      return existing;
    }

    // Create an empty conversation shell. Per requirement #1, the
    // conversation only becomes "visible" to both users once a message
    // is sent — but creating it now lets the frontend immediately open
    // a chat window and call sendMessage.
    return prisma.conversation.create({
      data: {
        userOneId,
        userTwoId,
        contextType: dto.auctionId ? "auction" : "direct",
        auctionId: dto.auctionId ?? null,
        lastMessageAt: new Date(0),
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  // Get a conversation, verifying the requester is a participant
  // ─────────────────────────────────────────────────────────
  private static async getConversationForUser(conversationId: number, userId: number) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new AppError(MESSAGES.CHAT.CONVERSATION_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    if (conversation.userOneId !== userId && conversation.userTwoId !== userId) {
      throw new AppError(MESSAGES.CHAT.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN);
    }

    return conversation;
  }

  // ─────────────────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────────────────
  static async sendMessage(senderId: number, dto: SendMessageDto) {
    const conversation = await ChatService.getConversationForUser(dto.conversationId, senderId);

    const receiverId = conversation.userOneId === senderId ? conversation.userTwoId : conversation.userOneId;

    const isReceiverOnline = await redisConnection.sismember(ONLINE_SET_KEY, receiverId.toString());

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId,
          receiverId,
          text: dto.text,
          status: isReceiverOnline ? "delivered" : "sent",
        },
      });

      // Reset deleted flags for both participants — a new message
      // should bring the conversation back into both sidebars
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: msg.createdAt,
          lastMessageId: msg.id,
          deletedByUserOne: false,
          deletedByUserTwo: false,
        },
      });

      return msg;
    });

    return { message, receiverId, conversationId: conversation.id, isFirstMessage: false };
  }

  // ─────────────────────────────────────────────────────────
  // CONVERSATION LIST (sidebar)
  // Only conversations with at least one real message (lastMessageId not null),
  // not soft-deleted by this user, sorted by lastMessageAt desc.
  // ─────────────────────────────────────────────────────────
  static async getConversationList(userId: number): Promise<ConversationListItem[]> {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { userOneId: userId, deletedByUserOne: false },
          { userTwoId: userId, deletedByUserTwo: false },
        ],
        lastMessageId: { not: null },
      },
      include: {
        userOne: { select: { id: true, name: true, photo: true } },
        userTwo: { select: { id: true, name: true, photo: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    if (conversations.length === 0) return [];

    // Batch unread counts
    const conversationIds = conversations.map((c) => c.id);
    const unreadCounts = await prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: conversationIds },
        receiverId: userId,
        status: { not: "read" },
      },
      _count: { id: true },
    });
    const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, u._count.id]));

    // Batch presence lookups
    const otherUserIds = conversations.map((c) => (c.userOneId === userId ? c.userTwoId : c.userOneId));
    const onlineStatuses = await Promise.all(
      otherUserIds.map((id) => redisConnection.sismember(ONLINE_SET_KEY, id.toString()))
    );
    const presenceRecords = await prisma.userPresence.findMany({
      where: { userId: { in: otherUserIds } },
    });
    const lastSeenMap = new Map(presenceRecords.map((p) => [p.userId, p.lastSeenAt]));

    return conversations.map((conv, idx) => {
      const otherUser = conv.userOneId === userId ? conv.userTwo : conv.userOne;
      const otherUserId = conv.userOneId === userId ? conv.userTwoId : conv.userOneId;
      const lastMsg = conv.messages[0];

      return {
        id: conv.id,
        otherUser: {
          id: otherUser.id,
          name: otherUser.name,
          photo: otherUser.photo,
          isOnline: !!onlineStatuses[idx],
          lastSeenAt: lastSeenMap.get(otherUserId) ?? null,
        },
        lastMessage: lastMsg
          ? { text: lastMsg.text, senderId: lastMsg.senderId, createdAt: lastMsg.createdAt, status: lastMsg.status }
          : null,
        unreadCount: unreadMap.get(conv.id) ?? 0,
        lastMessageAt: conv.lastMessageAt,
        auctionId: conv.auctionId,
      };
    });
  }

  // ─────────────────────────────────────────────────────────
  // GET SINGLE CONVERSATION (with other-user details)
  // ─────────────────────────────────────────────────────────
  static async getConversationById(conversationId: number, userId: number) {
    const conversation = await ChatService.getConversationForUser(conversationId, userId);

    const otherUserId = conversation.userOneId === userId ? conversation.userTwoId : conversation.userOneId;
    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, name: true, photo: true, email: true },
    });

    const isOnline = await redisConnection.sismember(ONLINE_SET_KEY, otherUserId.toString());
    const presence = await prisma.userPresence.findUnique({ where: { userId: otherUserId } });

    return {
      ...conversation,
      otherUser: { ...otherUser, isOnline: !!isOnline, lastSeenAt: presence?.lastSeenAt ?? null },
    };
  }

  // ─────────────────────────────────────────────────────────
  // GET MESSAGES (cursor-based pagination, newest first, returns ascending for display)
  // ─────────────────────────────────────────────────────────
  static async getMessages(conversationId: number, userId: number, cursor?: number, limit = 30) {
    await ChatService.getConversationForUser(conversationId, userId);

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { id: "desc" },
      take: limit + 1, // fetch one extra to determine if there's a next page
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? page[page.length - 1]!.id : null;

    return { messages: page.reverse(), nextCursor, hasMore };
  }

  // ─────────────────────────────────────────────────────────
  // MARK CONVERSATION AS READ
  // ─────────────────────────────────────────────────────────
  static async markAsRead(conversationId: number, userId: number) {
    const conversation = await ChatService.getConversationForUser(conversationId, userId);

    const result = await prisma.message.updateMany({
      where: {
        conversationId,
        receiverId: userId,
        status: { not: "read" },
      },
      data: { status: "read" },
    });

    const otherUserId = conversation.userOneId === userId ? conversation.userTwoId : conversation.userOneId;

    return { updatedCount: result.count, conversationId, otherUserId };
  }

  // ─────────────────────────────────────────────────────────
  // UNREAD COUNT (total across all conversations)
  // ─────────────────────────────────────────────────────────
  static async getUnreadCount(userId: number) {
    const count = await prisma.message.count({
      where: { receiverId: userId, status: { not: "read" } },
    });
    return { unreadCount: count };
  }

  // ─────────────────────────────────────────────────────────
  // SOFT DELETE CONVERSATION (per-user)
  // ─────────────────────────────────────────────────────────
  static async deleteConversation(conversationId: number, userId: number) {
    const conversation = await ChatService.getConversationForUser(conversationId, userId);

    const isUserOne = conversation.userOneId === userId;

    await prisma.conversation.update({
      where: { id: conversationId },
      data: isUserOne ? { deletedByUserOne: true } : { deletedByUserTwo: true },
    });
  }

  // ─────────────────────────────────────────────────────────
  // MARK MESSAGES AS DELIVERED (when receiver comes online / joins room)
  // ─────────────────────────────────────────────────────────
  static async markDelivered(conversationId: number, receiverId: number) {
    const result = await prisma.message.updateMany({
      where: { conversationId, receiverId, status: "sent" },
      data: { status: "delivered" },
    });
    return result.count;
  }

  // ─────────────────────────────────────────────────────────
  // REPORT USER
  // ─────────────────────────────────────────────────────────
  static async reportUser(reporterId: number, dto: ReportUserDto) {
    if (reporterId === dto.reportedUserId) {
      throw new AppError("You cannot report yourself", HTTP_STATUS.BAD_REQUEST);
    }

    const reportedUser = await prisma.user.findUnique({ where: { id: dto.reportedUserId } });
    if (!reportedUser) {
      throw new AppError(MESSAGES.USER.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    return prisma.report.create({
      data: {
        reporterId,
        reportedUserId: dto.reportedUserId,
        reason: dto.reason,
        description: dto.description ?? null,
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  // PRESENCE
  // ─────────────────────────────────────────────────────────
  static async setUserOnline(userId: number) {
    await redisConnection.sadd(ONLINE_SET_KEY, userId.toString());
  }

  static async setUserOffline(userId: number) {
    await redisConnection.srem(ONLINE_SET_KEY, userId.toString());
    await prisma.userPresence.upsert({
      where: { userId },
      update: { isOnline: false, lastSeenAt: new Date() },
      create: { userId, isOnline: false, lastSeenAt: new Date() },
    });
  }

  static async getOnlineFriends(userId: number): Promise<number[]> {
    // Get all conversation partners
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ userOneId: userId }, { userTwoId: userId }] },
      select: { userOneId: true, userTwoId: true },
    });

    const partnerIds = conversations.map((c) => (c.userOneId === userId ? c.userTwoId : c.userOneId));
    if (partnerIds.length === 0) return [];

    const onlineChecks = await Promise.all(
      partnerIds.map((id) => redisConnection.sismember(ONLINE_SET_KEY, id.toString()))
    );

    return partnerIds.filter((_, idx) => onlineChecks[idx]);
  }
}