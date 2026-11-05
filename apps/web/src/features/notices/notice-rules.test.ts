// The card rules (TC-F04-52, 53, 56, 58; AC-F04-31, 32, 33): what gives a card, what it says, merging.
import type { ChatMessageView } from "@meetapp/contracts";
import { describe, expect, it } from "vitest";
import { MAX_AGE_MS, Merger, SHOWING_MS, decide, previewText, type Incoming } from "./notice-rules.ts";

const NOW = Date.parse("2026-11-05T10:00:00Z");
const ME = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const ALL_ON = { messages: true, mentions: true, lobby: true, sound: true, preview: true };

const paragraph = (...content: object[]) =>
  ({ v: 1, blocks: [{ type: "paragraph", content }] }) as unknown as ChatMessageView["body"];
const message = (more: Partial<ChatMessageView> = {}): ChatMessageView =>
  ({
    id: "m1",
    kind: "text",
    sender: { attendanceId: null, name: "Bea", group: "member", userId: B },
    body: paragraph({ type: "text", text: "Hello there" }),
    createdAt: new Date(NOW - 1_000).toISOString(),
    deletedAt: null,
    ...more,
  }) as ChatMessageView;
const incoming = (more: Partial<Incoming> = {}): Incoming => ({
  conversationId: "c1",
  message: message(),
  chat: { title: "Release team", kind: "group", muted: false, photoUrl: null },
  me: ME,
  shownChat: undefined,
  settings: ALL_ON,
  serverNow: NOW,
  ...more,
});

describe("notice rules", () => {
  it("TC-F04-52 [AC-F04-31] the first 100 characters, spaces tidied", () => {
    const long = message({ body: paragraph({ type: "text", text: `${"word ".repeat(60)}end` }) });
    expect(previewText(long)).toHaveLength(100);
    expect(decide(incoming())).toEqual({ show: true, mention: false, text: "Hello there" });
    expect(previewText(message({ kind: "gif", body: null }))).toBeNull();
  });

  it("TC-F04-53 [AC-F04-31] no card: own, shown in front, muted, switched off, over 5 minutes by the server", () => {
    expect(
      decide(
        incoming({ message: message({ sender: { attendanceId: null, name: "Me", group: "member", userId: ME } }) }),
      ),
    ).toEqual({ show: false });
    expect(decide(incoming({ shownChat: "c1" }))).toEqual({ show: false });
    expect(decide(incoming({ chat: { title: "x", kind: "group", muted: true, photoUrl: null } }))).toEqual({
      show: false,
    });
    expect(decide(incoming({ settings: { ...ALL_ON, messages: false } }))).toEqual({ show: false });
    // The server's clock (not this computer's) says the message is over 5 minutes old.
    expect(decide(incoming({ serverNow: NOW + MAX_AGE_MS }))).toEqual({ show: false });
    expect(decide(incoming({ message: message({ kind: "system" }) }))).toEqual({ show: false });
    // Open in another chat, or only in a hidden window (shownChat undefined): a card.
    expect(decide(incoming({ shownChat: "c2" })).show).toBe(true);
  });

  it("TC-F04-58 [AC-F04-33] a mention gives one mention card, even muted; mentions off gives none at all", () => {
    const mentioned = message({
      body: paragraph({ type: "mention", userId: ME, text: "@Olivia" }, { type: "text", text: " look" }),
    });
    const muted = { title: "x", kind: "group" as const, muted: true, photoUrl: null };
    expect(decide(incoming({ message: mentioned, chat: muted }))).toEqual({
      show: true,
      mention: true,
      text: "@Olivia look",
    });
    expect(decide(incoming({ message: mentioned, settings: { ...ALL_ON, mentions: false } }))).toEqual({ show: false });
    const someoneElse = message({ body: paragraph({ type: "mention", userId: B, text: "@Bea" }) });
    expect(decide(incoming({ message: someoneElse, chat: muted }))).toEqual({ show: false });
  });

  it("TC-F04-56 [AC-F04-32] messages of one chat merge while the card shows; another chat gets its own", () => {
    const merger = new Merger();
    const first = merger.add("y", 0);
    expect(first).toMatchObject({ count: 1, fresh: true });
    expect(merger.add("y", 1_000)).toEqual({ cardId: first.cardId, count: 2, fresh: false });
    expect(merger.add("y", 2_000)).toEqual({ cardId: first.cardId, count: 3, fresh: false });
    expect(merger.add("z", 2_500)).toMatchObject({ count: 1, fresh: true });
    // The card went (8 s after the last change, or closed): a new card with its sound.
    expect(merger.add("y", 2_000 + SHOWING_MS)).toMatchObject({ count: 1, fresh: true });
    const again = merger.add("q", 0);
    merger.closed(again.cardId);
    expect(merger.add("q", 1)).toMatchObject({ fresh: true });
  });
});
