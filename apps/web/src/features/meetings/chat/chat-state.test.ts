// Chat state rules (F03 TC-F03-04, 11, 15, 92 app parts): messages in time order and never twice,
// unread only while closed, sending and "Not sent", and gaps in the server's news noticed.
import type { ChatEvent, ChatMessageView } from "@meetapp/contracts";
import { describe, expect, it } from "vitest";
import { chatReducer, emptyChat, missedNews, type ChatState } from "./chat-state.ts";

const DOC = {
  v: 1 as const,
  blocks: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: "hi" }] }],
};
let n = 0;
function message(overrides: Partial<ChatMessageView> = {}): ChatMessageView {
  n += 1;
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  return {
    id,
    cursor: `c${String(n)}`,
    kind: "text",
    sender: { attendanceId: "someone", name: "Bilal Ahmed", group: "member", userId: null },
    body: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: `m${String(n)}` }] }] },
    createdAt: new Date(Date.UTC(2026, 9, 20, 10, 0, n)).toISOString(),
    editedAt: null,
    deletedAt: null,
    replyTo: null,
    reactions: [],
    attachments: [],
    gif: null,
    sticker: null,
    pollId: null,
    system: null,
    ...overrides,
  };
}
const created = (seq: number, m: ChatMessageView): ChatEvent => ({
  seq,
  type: "message_created",
  id: m.id,
  message: m,
});
const run = (state: ChatState, ...actions: Parameters<typeof chatReducer>[1][]) => actions.reduce(chatReducer, state);

describe("chat state", () => {
  it("TC-F03-04 [AC-F03-02] pages and news merge in time order, never twice", () => {
    const [a, b, c] = [message(), message(), message()];
    const state = run(
      emptyChat,
      { type: "page", messages: [c, b], hasMore: true, older: false },
      { type: "page", messages: [b, a], hasMore: false, older: true },
      { type: "event", event: created(5, c), mine: false },
    );
    expect(state.messages.map((m) => m.id)).toEqual([a.id, b.id, c.id]);
    expect(state.hasMore).toBe(false);
  });

  it("TC-F03-15 [AC-F03-07] new messages from others count as unread only while the chat is closed", () => {
    const state = run(
      emptyChat,
      { type: "page", messages: [], hasMore: false, older: false },
      { type: "event", event: created(1, message()), mine: false },
      { type: "event", event: created(2, message()), mine: true },
      { type: "event", event: created(3, message({ kind: "system" })), mine: false },
    );
    expect(state.unread).toBe(1);
    const opened = run(
      state,
      { type: "open", open: true },
      { type: "event", event: created(4, message()), mine: false },
    );
    expect(opened.unread).toBe(0);
  });

  it("TC-F03-11 [AC-F03-05] a send that fails is marked Not sent and leaves when it succeeds", () => {
    const sent = message();
    const failed = run(
      emptyChat,
      { type: "sending", item: { clientId: "c1", content: { body: DOC }, status: "sending" } },
      { type: "failed", clientId: "c1", tooFast: false },
    );
    expect(failed.sending).toEqual([{ clientId: "c1", content: { body: DOC }, status: "failed" }]);
    const retried = run(
      failed,
      { type: "sending", item: { clientId: "c1", content: { body: DOC }, status: "sending" } },
      { type: "sent", clientId: "c1", message: sent },
    );
    expect(retried.sending).toEqual([]);
    expect(retried.messages.map((m) => m.id)).toEqual([sent.id]);
  });

  it("TC-F03-92 [AC-F03-01] a gap in the news numbers is noticed", () => {
    const state = run(
      emptyChat,
      { type: "page", messages: [], hasMore: false, older: false },
      { type: "event", event: created(3, message()), mine: false },
    );
    expect(missedNews(state, created(4, message()))).toBe(false);
    expect(missedNews(state, created(6, message()))).toBe(true);
  });

  it("TC-F03-21 [AC-F03-10] [AC-F03-20] a deleted message replaces the old one and leaves the pinned list", () => {
    const m = message();
    const deleted = { ...m, body: null, deletedAt: new Date().toISOString() };
    const state = run(
      emptyChat,
      { type: "page", messages: [m], hasMore: false, older: false, pinned: [m] },
      { type: "event", event: { seq: 2, type: "message_deleted", id: m.id, message: deleted }, mine: false },
    );
    expect(state.messages[0]?.deletedAt).not.toBeNull();
    expect(state.pinned).toEqual([]);
  });
});
