// The main window's side of F04's notification cards (TC-F04-54, 55, 57, 10; AC-F04-31, 32, 33, 04): a
// new message on the live line becomes a card for the desktop app, merged per chat, with one chime; a
// clicked card opens its chat; the first close shows "still running". The app's pieces around it are fake.
import type { ConversationList, NoticeCard } from "@meetapp/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotices } from "./use-notices.ts";

const ME = "00000000-0000-4000-8000-000000000001";
const BEA = "00000000-0000-4000-8000-000000000002";
const ALL_ON = { messages: true, mentions: true, lobby: true, sound: true, preview: true };

const fake = vi.hoisted(() => ({
  line: undefined as ((message: unknown) => void) | undefined,
  stillRunning: undefined as ((where: "tray" | "menuBar") => void) | undefined,
  settings: { messages: true, mentions: true, lobby: true, sound: true, preview: true },
  shownChat: undefined as string | undefined,
  openChat: vi.fn(),
  chime: vi.fn(),
}));

vi.mock("../auth/index.ts", () => ({ useSession: () => ({ data: { id: ME } }) }));
vi.mock("../notifications/index.ts", () => ({ useNotificationSettings: () => ({ settings: fake.settings }) }));
vi.mock("../calls/index.ts", () => ({
  useChatCall: (pick: (state: { openChat: typeof fake.openChat }) => unknown) => pick({ openChat: fake.openChat }),
}));
vi.mock("../desktop-app/index.ts", () => ({
  useTrayCommands: ({ onStillRunning }: { onStillRunning: typeof fake.stillRunning }) => {
    fake.stillRunning = onStillRunning;
  },
}));
vi.mock("../chats/index.ts", () => ({
  useLiveLine: (listener: (message: unknown) => void) => {
    fake.line = listener;
    return { serverNow: () => Date.now() };
  },
}));
vi.mock("./chime.ts", () => ({ chime: fake.chime }));
vi.mock("./shown-chat.ts", () => ({ chatInFront: () => fake.shownChat }));
vi.mock("../call-windows/photos.ts", () => ({ asDataUrl: () => Promise.resolve("data:image/png;base64,AAAA") }));

const shown: NoticeCard[] = [];
const removed: string[] = [];
let press: (action: unknown) => void = () => undefined;

const news = (text: string, more: Record<string, unknown> = {}) => ({
  t: "news",
  conversationId: "c1",
  event: {
    type: "message_created",
    message: {
      id: `m-${text}`,
      kind: "text",
      sender: { attendanceId: null, name: "Bea Khan", group: "member", userId: BEA },
      body: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text }] }] },
      createdAt: new Date(Date.now() - 1_000).toISOString(),
      deletedAt: null,
      ...more,
    },
  },
});

function Notices({ toChat }: { toChat: () => void }) {
  useNotices({ toChat });
  return null;
}

function start(kind: "group" | "direct" = "group") {
  const client = new QueryClient();
  const list = {
    conversations: [
      {
        id: "c1",
        title: "Release team",
        kind,
        muted: false,
        people: [{ userId: BEA, photoUrl: kind === "direct" ? "/files/bea.png" : null }],
      },
    ],
  } as unknown as ConversationList;
  client.setQueryData(["chats", "list"], list);
  const toChat = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <Notices toChat={toChat} />
    </QueryClientProvider>,
  );
  return { client, toChat, view };
}

beforeEach(() => {
  shown.length = 0;
  removed.length = 0;
  fake.settings = { ...ALL_ON };
  fake.shownChat = undefined;
  (window as { meetapp?: unknown }).meetapp = {
    notices: { show: (card: NoticeCard) => shown.push(card), remove: (id: string) => removed.push(id) },
    callWindows: {
      onAction: (listener: (action: unknown) => void) => {
        press = listener;
        return () => undefined;
      },
    },
  };
});
afterEach(() => {
  delete (window as { meetapp?: unknown }).meetapp;
  vi.clearAllMocks();
});

describe("notification cards from the main window", () => {
  it("TC-F04-54 [AC-F04-31] a message gives a card with name, chat and text, and one chime", async () => {
    start();
    act(() => fake.line?.(news("Can you look?")));
    await waitFor(() => expect(shown).toHaveLength(1));
    expect(shown[0]).toMatchObject({
      kind: "message",
      title: "Bea Khan",
      detail: "Release team",
      text: "Can you look?",
      close: "Close",
    });
    expect(shown[0]?.id).toMatch(/^chat:c1:/);
    expect(fake.chime).toHaveBeenCalledTimes(1);
  });

  it("TC-F04-57 [AC-F04-32] quick messages in one chat merge into one card with one chime", async () => {
    start();
    for (const text of ["One", "Two", "Three"]) act(() => fake.line?.(news(text)));
    await waitFor(() => expect(shown).toHaveLength(3));
    expect(new Set(shown.map((card) => card.id)).size).toBe(1);
    expect(shown[2]?.detail).toBe("Release team · 3 new messages");
    expect(fake.chime).toHaveBeenCalledTimes(1);
  });

  it("TC-F04-55 [AC-F04-31] preview off: 'New message', never the words; sound off: no chime", async () => {
    fake.settings = { ...ALL_ON, preview: false, sound: false };
    start("direct");
    act(() => fake.line?.(news("secret words")));
    await waitFor(() => expect(shown).toHaveLength(1));
    expect(shown[0]?.text).toBe("New message");
    expect(JSON.stringify(shown[0])).not.toContain("secret");
    // A direct chat has no chat name; the sender's picture travels as a checked picture.
    expect(shown[0]?.detail).toBeUndefined();
    expect(shown[0]?.person?.photo).toMatch(/^data:image\/png/);
    expect(fake.chime).not.toHaveBeenCalled();
  });

  it("TC-F04-53 [AC-F04-31] no card for the chat in front, other events, or quiet status", async () => {
    const { client } = start();
    fake.shownChat = "c1";
    act(() => fake.line?.(news("in front")));
    act(() => fake.line?.({ t: "news", conversationId: "c1", event: { type: "message_deleted" } }));
    act(() => fake.line?.({ t: "connected" }));
    fake.shownChat = undefined;
    client.setQueryData(["me", "status"], { chosen: "dnd", until: null });
    act(() => fake.line?.(news("quiet")));
    await new Promise((done) => setTimeout(done, 20));
    expect(shown).toEqual([]);
  });

  it("TC-F04-33 [AC-F04-33] a mention is tagged; with preview off it carries no text", async () => {
    fake.settings = { ...ALL_ON, preview: false };
    start();
    const body = { v: 1, blocks: [{ type: "paragraph", content: [{ type: "mention", userId: ME, name: "Me" }] }] };
    act(() => fake.line?.(news("x", { body })));
    await waitFor(() => expect(shown).toHaveLength(1));
    expect(shown[0]).toMatchObject({ kind: "mention", tag: "mentioned you" });
    expect(shown[0]?.text).toBeUndefined();
  });

  it("TC-F04-54 [AC-F04-31] a clicked card opens its chat; × only closes it; others are ignored", async () => {
    const { toChat } = start();
    act(() => fake.line?.(news("Hello")));
    await waitFor(() => expect(shown).toHaveLength(1));
    const cardId = shown[0]?.id ?? "";
    act(() => press({ name: "noticeChosen", cardId: "lobby:x", choice: "open" }));
    act(() => press({ name: "noticeChosen", cardId, choice: "close" }));
    expect(toChat).not.toHaveBeenCalled();
    act(() => press({ name: "noticeChosen", cardId, choice: "open" }));
    expect(fake.openChat).toHaveBeenCalledWith("c1");
    expect(toChat).toHaveBeenCalledTimes(1);
  });

  it("TC-F04-10 [AC-F04-04] the first close shows 'still running' with the right place", () => {
    start();
    act(() => fake.stillRunning?.("menuBar"));
    act(() => fake.stillRunning?.("tray"));
    expect(shown.map((card) => [card.id, card.kind, card.title])).toEqual([
      ["still-running", "running", "MeetApp is still running"],
      ["still-running", "running", "MeetApp is still running"],
    ]);
    expect(shown[0]?.text).not.toBe(shown[1]?.text);
  });

  it("TC-F04-95 [AC-F04-30] signing out takes the cards away", async () => {
    const { view } = start();
    act(() => fake.line?.(news("Hello")));
    await waitFor(() => expect(shown).toHaveLength(1));
    view.unmount();
    expect(removed).toEqual([shown[0]?.id]);
  });
});
