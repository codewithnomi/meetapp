// What an open chat shows beyond its messages (F14 AC-F14-14, 22–24): who is typing (from the live line,
// gone 5 seconds after the last signal), "Seen" under one's own last message, the chat's people (for
// group details and @mentions), and the chat requests waiting for the person.
import type { ChatMessageView } from "@meetapp/contracts";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/index.ts";
import { chatRequests, seenBy } from "./chats-api.ts";
import { useLiveLine } from "./LiveLineProvider.tsx";
import { createTypingList, createTypingSender } from "./typing.ts";

export interface ChatMember {
  userId: string;
  name: string;
  photoUrl: string | null;
  external: boolean;
  pending: boolean;
  status: "available" | "away" | "in_call" | "offline" | null;
}

export function useMembers(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: ["chats", "members", conversationId],
    queryFn: () => apiRequest<{ people: ChatMember[] }>(`/api/v1/conversations/${conversationId}/members`),
    enabled,
  });
}

export function useChatRequests() {
  return useQuery({ queryKey: ["chats", "requests"], queryFn: chatRequests });
}

/** Others typing in this chat, and the signal to send while the person types (at most every 3 s). */
export function useTyping(conversationId: string, userId: string) {
  const [list] = useState(() => createTypingList(Date.now));
  const [sender] = useState(() => createTypingSender(Date.now));
  const [names, setNames] = useState<string[]>([]);
  const line = useLiveLine(
    useCallback(
      (message) => {
        if (message.t === "typing" && message.conversationId === conversationId && message.userId !== userId) {
          list.signal(message.userId, message.name);
          setNames(list.names());
        }
        // A message from someone ends their typing at once.
        if (message.t === "news" && message.conversationId === conversationId && message.event.message?.sender.userId) {
          list.stopped(message.event.message.sender.userId);
          setNames(list.names());
        }
      },
      [conversationId, userId, list],
    ),
  );
  // The name goes 5 seconds after the last signal.
  useEffect(() => {
    if (names.length === 0) return;
    const timer = setInterval(() => setNames(list.names()), 1000);
    return () => clearInterval(timer);
  }, [names.length, list]);
  const onTyping = useCallback(() => {
    if (sender.shouldSend()) line?.send({ t: "typing", conversationId });
  }, [sender, line, conversationId]);
  return { names, onTyping };
}

/** The person's own newest message, and who has seen it (refreshed by "read" news; AC-F14-24). */
export function useSeen(conversationId: string, messages: ChatMessageView[], userId: string) {
  const own = useMemo(
    () => [...messages].reverse().find((message) => message.sender.userId === userId && message.kind !== "system"),
    [messages, userId],
  );
  const seen = useQuery({
    queryKey: ["chats", "seen", conversationId, own?.id],
    queryFn: () => seenBy(conversationId, own?.id ?? ""),
    enabled: own !== undefined,
  });
  useLiveLine(
    useCallback(
      (message) => {
        if (message.t === "read" && message.conversationId === conversationId) void seen.refetch();
      },
      [conversationId, seen],
    ),
  );
  const people = seen.data?.people ?? null;
  return { own, people: people && people.length > 0 ? people : null };
}
