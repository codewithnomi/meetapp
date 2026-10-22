// The chat list of a workspace (AC-F14-01–05), refreshed by the live line's news, and the number of chats
// with unread messages for the side menu's badge (AC-F14-02).
import { useQuery } from "@tanstack/react-query";
import { chatList, type ChatFilter } from "./chats-api.ts";
import { usePolling } from "./LiveLineProvider.tsx";

/** While news can't arrive on the line, the list is fetched again this often (TC-F14-44). */
const LIST_POLL_MS = 30_000;

export function useChatList(workspaceId: string | undefined, filter: ChatFilter, q: string) {
  const polling = usePolling();
  return useQuery({
    refetchInterval: polling ? LIST_POLL_MS : false,
    queryKey: ["chats", workspaceId, filter, q],
    queryFn: () => chatList(workspaceId ?? "", filter, q),
    enabled: workspaceId !== undefined,
  });
}

/** Chats with unread messages, for the Chat item's badge. */
export function useUnreadChats(workspaceId: string | undefined): number {
  return useChatList(workspaceId, "all", "").data?.unreadChats ?? 0;
}
