// What goes out on the live line (D064; F14 design.md 3.4): news of a chat on `conv:<id>`, list changes
// and line controls on `user:<id>`. Published through Redis so every API server hears it and passes it
// to its own connected lines (one Redis message per news item, TC-F14-43).
import type { ChatEvent, LineServerMessage, Status } from "@meetapp/contracts";
import type { Redis } from "ioredis";

export const channels = {
  conversation: (id: string) => `meetapp:chats:conv:${id}`,
  user: (id: string) => `meetapp:chats:user:${id}`,
  status: (id: string) => `meetapp:chats:status:${id}`,
};

/** Internal notes between servers on a person's channel; never forwarded to apps. */
export type LineControl = { control: "close"; lineId: string } | { control: "refresh" };

type ListChange = "added" | "changed" | "removed";

export function createLivePublisher(redis: Redis) {
  const send = (channel: string, message: LineServerMessage | LineControl) =>
    redis.publish(channel, JSON.stringify(message)).then(() => undefined);
  return {
    news: (conversationId: string, event: ChatEvent) =>
      send(channels.conversation(conversationId), { t: "news", conversationId, event }),
    /** A chat appeared, changed or went for these people: their lines follow it within 2 seconds (AC-18, 34). */
    list: async (userIds: string[], conversationId: string, change: ListChange) => {
      await Promise.all(
        [...new Set(userIds)].map((id) => send(channels.user(id), { t: "list", conversationId, change })),
      );
    },
    read: (conversationId: string, userId: string, seq: number) =>
      send(channels.conversation(conversationId), { t: "read", conversationId, userId, seq }),
    typing: (conversationId: string, userId: string, name: string) =>
      send(channels.conversation(conversationId), { t: "typing", conversationId, userId, name }),
    status: (userId: string, status: Status) => send(channels.status(userId), { t: "status", userId, status }),
    control: (userId: string, control: LineControl) => send(channels.user(userId), control),
  };
}

export type LivePublisher = ReturnType<typeof createLivePublisher>;
