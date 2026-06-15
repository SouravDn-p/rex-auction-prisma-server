export interface StartConversationDto {
    otherUserId: number;
    auctionId?: number;
  }
  
  export interface SendMessageDto {
    conversationId: number;
    text: string;
  }
  
  export interface MarkReadDto {
    conversationId: number;
  }
  
  export interface ReportUserDto {
    reportedUserId: number;
    reason: string;
    description?: string;
  }
  
  export interface ConversationListItem {
    id: number;
    otherUser: {
      id: number;
      name: string;
      photo: string | null;
      isOnline: boolean;
      lastSeenAt: Date | null;
    };
    lastMessage: {
      text: string;
      senderId: number;
      createdAt: Date;
      status: string;
    } | null;
    unreadCount: number;
    lastMessageAt: Date;
    auctionId: number | null;
  }