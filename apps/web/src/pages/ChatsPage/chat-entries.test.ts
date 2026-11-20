// The chat row of the call the person is in (F17 TC-F17-22, AC-F17-08): it says "Call in progress"
// instead of its last line, also in its name for screen readers; other rows are unchanged.
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import type { ChatItem } from "../../features/chats/index.ts";
import { entryOf } from "./chat-entries.ts";

const t = i18n.t.bind(i18n);
const item = {
  id: "conv1",
  kind: "group",
  title: "Release team",
  people: [],
  unread: 0,
  muted: false,
  status: null,
  lastMessage: { at: "2026-11-14T10:00:00Z", own: true, firstLine: "Thanks", senderName: "Mo" },
} as unknown as ChatItem;
const context = { now: new Date("2026-11-14T12:00:00Z"), locale: "en", current: false, onSelect: vi.fn() };

describe("chat rows during a call", () => {
  it("TC-F17-22 [AC-F17-08] the call's chat says Call in progress; others show their last line", () => {
    const inCall = entryOf(t, item, { ...context, inCall: true });
    expect(inCall.lastLine).toBe("Call in progress");
    expect(inCall.label).toContain("Call in progress");
    expect(entryOf(t, item, context).lastLine).toBe("You: Thanks");
  });
});
