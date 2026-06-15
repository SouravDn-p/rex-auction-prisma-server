import { getConversationPath } from "./paths/get-conversation.path.ts";
import { getMessagesPath } from "./paths/get-messages.path.ts";
import { listConversationsPath } from "./paths/list-conversations.path.ts";
import { markReadPath } from "./paths/mark-read.path.ts";
import { reportUserPath } from "./paths/report-user.path.ts";
import { sendMessagePath } from "./paths/send-message.path.ts";
import { startConversationPath } from "./paths/start-conversation.path.ts";
import { unreadCountPath } from "./paths/unread-count.path.ts";

export const chatPaths = {
  "/chat/conversations/start": startConversationPath,
  "/chat/conversations": listConversationsPath,
  "/chat/conversations/{id}": getConversationPath,
  "/chat/messages": sendMessagePath,
  "/chat/messages/unread-count": unreadCountPath,
  "/chat/messages/{conversationId}": getMessagesPath,
  "/chat/messages/read": markReadPath,
  "/chat/reports/user": reportUserPath,
};
