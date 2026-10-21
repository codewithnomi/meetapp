// TC-F03-78 [AC-F03-46]: the chat follows the app's language. The app ships English only for now, so a
// made-up test language (every English text marked "[xx]") stands in for a second one: the app's words
// and notes change, people's own messages stay exactly as written.
import type { ChatMessageView } from "@meetapp/contracts";
import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json" with { type: "json" };
import type { Chat, ChatPlace } from "../../features/meetings/chat/index.ts";
import { Message, type ChatView } from "./ChatMessages.tsx";

const mark = (node: unknown): unknown =>
  typeof node === "string"
    ? `[xx] ${node}`
    : Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, mark(v)]));

const view = {
  chat: { state: { pinned: [] } } as unknown as Chat,
  place: { path: "/x", headers: {}, attendanceId: "me" } as ChatPlace,
  rights: { moderate: true, createPoll: true, attach: true },
  readOnly: false,
  onReply: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onFailed: vi.fn(),
} satisfies ChatView;

const base = {
  cursor: "c",
  clientId: "x",
  sender: { attendanceId: "b", name: "Bilal Ahmed", group: "member", userId: null },
  createdAt: "2026-10-21T10:00:00.000Z",
  editedAt: null,
  deletedAt: null,
  replyTo: null,
  reactions: [],
  attachments: [],
  gif: null,
  sticker: null,
  pollId: null,
} as const;
const said = {
  ...base,
  id: "00000000-0000-4000-8000-000000000001",
  kind: "text",
  body: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "Hello team" }] }] },
  system: null,
} as unknown as ChatMessageView;
const note = {
  ...base,
  id: "00000000-0000-4000-8000-000000000002",
  kind: "system",
  body: null,
  system: { event: "pinned", name: "Aisha Khan" },
} as unknown as ChatMessageView;

describe("chat language", () => {
  beforeAll(async () => {
    i18n.addResourceBundle("xx", "translation", mark(en));
    await i18n.changeLanguage("xx");
  });
  afterAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("TC-F03-78 [AC-F03-46] notes and labels follow the language; people's messages stay as written", () => {
    render(
      <>
        <Message view={view} message={said} />
        <Message view={view} message={note} />
      </>,
    );
    expect(screen.getByText("Hello team")).toBeInTheDocument();
    expect(screen.getByText("[xx] Aisha Khan pinned a message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "[xx] Reply" })).toBeInTheDocument();
  });
});
