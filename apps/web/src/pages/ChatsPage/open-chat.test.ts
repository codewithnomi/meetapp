// The open chat stays open when the list's filter or search hides it (F14 T-fix-3; AC-F14-03, 04).
import { describe, expect, it } from "vitest";
import type { ChatItem } from "../../features/chats/index.ts";
import { openChatOf } from "./open-chat.ts";

const chat = (id: string) => ({ id }) as ChatItem;

describe("the open chat", () => {
  it("TC-F14-05 [AC-F14-03] stays open when the filter or search no longer lists it", () => {
    expect(openChatOf("a", [chat("a"), chat("b")], [chat("b")])?.id).toBe("a");
  });

  it("TC-F14-05 [AC-F14-03] uses the shown list while every chat is still loading", () => {
    expect(openChatOf("b", undefined, [chat("b")])?.id).toBe("b");
  });

  it("TC-F14-05 [AC-F14-03] closes when the chat is really gone (left, hidden) or none is open", () => {
    expect(openChatOf("a", [chat("b")], [])).toBeUndefined();
    expect(openChatOf(undefined, [chat("a")], [chat("a")])).toBeUndefined();
  });
});
