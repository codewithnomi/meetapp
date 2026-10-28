// The Chat screen with a stand-in backend (F14 T-fix-6; AC-F14-01, 03, 06, 07): the list's loading and
// error states with Retry, the open chat staying open when a filter hides it, and New chat's Start
// working once.
import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { fakeApi, json, IDS } from "../../features/workspaces/fake-api.ts";
import { CurrentWorkspaceProvider } from "../../features/workspaces/index.ts";
import { useChatCall } from "../../features/calls/index.ts";
import { ChatsPage } from "./ChatsPage.tsx";

const CHAT = "00000000-0000-4000-8000-0000000000c1";
const BILAL = "00000000-0000-4000-8000-0000000000b1";
const LIST = `/api/v1/workspaces/${IDS.aria}/conversations`;

const item = {
  id: CHAT,
  kind: "direct",
  meetingId: null,
  title: "Bilal Ahmed",
  people: [{ userId: BILAL, name: "Bilal Ahmed", photoUrl: null, external: false }],
  status: null,
  lastMessage: null,
  unread: 1,
  mentioned: false,
  pinned: false,
  muted: false,
  readOnly: false,
  readOnlyReason: null,
  request: null,
};
const list = (conversations: unknown[]) => json({ conversations, unreadChats: conversations.length });

beforeEach(() => installFakeAuth(PAT));
afterEach(() => vi.unstubAllGlobals());

const show = () =>
  renderWithApp(
    <CurrentWorkspaceProvider>
      <ChatsPage onNavigate={vi.fn()} />
    </CurrentWorkspaceProvider>,
  );
const chatList = () => screen.getByRole("region", { name: "Chat" });

describe("the Chat screen", () => {
  it('TC-F14-01 [AC-F14-01] a failed list says so with Retry (never "No chats yet"); Retry loads it', async () => {
    let fail = true;
    fakeApi({
      [LIST]: () => (fail ? json({ error: { code: "INTERNAL" } }, 500) : list([item])),
      "/api/v1/me/chat-requests": () => json({ requests: [] }),
    });
    show();
    expect(await within(chatList()).findByText(/Couldn't load this/)).toBeInTheDocument();
    expect(screen.queryByText("No chats yet")).not.toBeInTheDocument();
    fail = false;
    await userEvent.click(within(chatList()).getByRole("button", { name: "Retry" }));
    expect(await within(chatList()).findByText("Bilal Ahmed")).toBeInTheDocument();
  });

  it("T-fix-9 [AC-F15-07] back from a call, its chat opens (left before or after the screen appears)", async () => {
    fakeApi({
      [LIST]: () => list([item]),
      "/api/v1/me/chat-requests": () => json({ requests: [] }),
    });
    const call = { callId: "00000000-0000-4000-8000-0000000000d1", conversationId: CHAT, media: "audio" as const };
    useChatCall.getState().begin({ ...call, title: "Bilal Ahmed", oneToOne: true, phase: "ringing" });
    useChatCall.getState().end();
    const view = show();
    expect(await screen.findByRole("heading", { level: 2, name: "Bilal Ahmed" })).toBeInTheDocument();
    view.unmount();

    show();
    await within(chatList()).findByRole("button", { name: /Bilal Ahmed/ });
    expect(screen.queryByRole("heading", { level: 2, name: "Bilal Ahmed" })).toBeNull();
    act(() => {
      useChatCall.getState().begin({ ...call, title: "Bilal Ahmed", oneToOne: true, phase: "ringing" });
      useChatCall.getState().end();
    });
    expect(await screen.findByRole("heading", { level: 2, name: "Bilal Ahmed" })).toBeInTheDocument();
  });

  it("TC-F14-05 [AC-F14-03] the open chat stays open when the Unread filter no longer lists it", async () => {
    let read = false;
    fakeApi({
      [LIST]: () => list(read ? [] : [item]),
      "/api/v1/me/chat-requests": () => json({ requests: [] }),
    });
    show();
    await userEvent.click(await within(chatList()).findByRole("button", { name: /Bilal Ahmed/ }));
    expect(await screen.findByRole("heading", { level: 2, name: "Bilal Ahmed" })).toBeInTheDocument();
    read = true;
    await userEvent.click(within(chatList()).getByRole("button", { name: "Unread" }));
    await waitFor(() => expect(within(chatList()).queryByRole("button", { name: /Bilal Ahmed/ })).toBeNull());
    expect(screen.getByRole("heading", { level: 2, name: "Bilal Ahmed" })).toBeInTheDocument();
  });

  it("TC-F14-15 [AC-F14-07] New chat's Start makes one chat even when pressed twice", async () => {
    let finish: (value: Response) => void = () => undefined;
    const api = fakeApi({
      [LIST]: () => list([]),
      "/api/v1/me/chat-requests": () => json({ requests: [] }),
      [`/api/v1/workspaces/${IDS.aria}/people`]: () =>
        json({ people: [{ userId: BILAL, name: "Bilal Ahmed", photoUrl: null, external: false, status: null }] }),
      [`POST ${LIST}`]: () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    });
    show();
    await userEvent.click(await within(chatList()).findByRole("button", { name: "New chat" }));
    await userEvent.type(screen.getByRole("combobox", { name: /To/ }), "Bil");
    await userEvent.click(await screen.findByRole("option", { name: /Bilal Ahmed/ }));
    const start = screen.getByRole("button", { name: "Start chat" });
    await userEvent.click(start);
    expect(screen.getByRole("button", { name: "Starting…" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Starting…" }));
    expect(api.callsTo("POST", LIST)).toHaveLength(1);
    finish(json({ id: CHAT }));
  });
});
