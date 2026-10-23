// Which chat the right side shows (AC-F14-03, 04): as in Teams, the open chat stays open while the list's
// filter or search hides it (read under "Unread", a search that no longer matches), so its draft is kept.
import type { ChatItem } from "../../features/chats/index.ts";

/** The open chat from every chat (unfiltered), or from the shown list while that is still loading. */
export function openChatOf(id: string | undefined, all: ChatItem[] | undefined, shown: ChatItem[]) {
  if (id === undefined) return undefined;
  return (all ?? shown).find((item) => item.id === id) ?? shown.find((item) => item.id === id);
}
