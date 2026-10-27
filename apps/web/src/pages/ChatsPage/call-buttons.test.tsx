// The chat header's call buttons (F15 T13): off with the reason in a read-only chat (AC-F15-02), pending and
// failure with Retry while starting (AC-F15-18), and Join in place of the buttons while a call runs (AC-F15-03).
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { useChatCall } from "../../features/calls/index.ts";
import { useVisit } from "../../features/meetings/index.ts";
import { fakeApi, json, refuse, IDS, type Handler } from "../../features/workspaces/fake-api.ts";
import { CurrentWorkspaceProvider } from "../../features/workspaces/index.ts";
import { ChatsPage } from "./ChatsPage.tsx";

const CHAT = "00000000-0000-4000-8000-0000000000c1";
const BILAL = "00000000-0000-4000-8000-0000000000b1";
const CALL_ID = "00000000-0000-4000-8000-0000000000d1";
const LIST = `/api/v1/workspaces/${IDS.aria}/conversations`;
const START = `POST /api/v1/conversations/${CHAT}/calls`;
const RUNNING = `/api/v1/conversations/${CHAT}/call`;
const JOIN = `/api/v1/calls/${CALL_ID}/join`;

const item = {
  id: CHAT,
  kind: "direct",
  meetingId: null,
  title: "Bilal Ahmed",
  people: [{ userId: BILAL, name: "Bilal Ahmed", photoUrl: null, external: false }],
  status: null,
  lastMessage: null,
  unread: 0,
  mentioned: false,
  pinned: false,
  muted: false,
  readOnly: false,
  readOnlyReason: null,
  request: null,
};
const JOINED = {
  attendanceId: "00000000-0000-4000-8000-0000000000a1",
  status: "in_call",
  title: "Bilal Ahmed",
  group: "member",
  ticket: "t-1",
  call: { callId: CALL_ID, serverUrl: "ws://127.0.0.1:7880", pass: "p", role: "organizer" },
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

async function open(chat: object, extra: Record<string, Handler> = {}) {
  const api = fakeApi({
    [LIST]: () => json({ conversations: [chat], unreadChats: 0 }),
    "/api/v1/me/chat-requests": () => json({ requests: [] }),
    [RUNNING]: () => json({ call: null }),
    ...extra,
  });
  renderWithApp(
    <CurrentWorkspaceProvider>
      <ChatsPage onNavigate={vi.fn()} />
      <Where />
    </CurrentWorkspaceProvider>,
  );
  await userEvent.click(await within(await screen.findByRole("region", { name: "Chat" })).findByText("Bilal Ahmed"));
  await screen.findByRole("heading", { level: 2, name: "Bilal Ahmed" });
  return api;
}

beforeEach(() => installFakeAuth(PAT));
afterEach(() => {
  useChatCall.getState().end();
  useVisit.getState().end();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const video = () => screen.getByRole("button", { name: "Video call" });
const audio = () => screen.getByRole("button", { name: "Audio call" });

describe("call buttons in a chat header", () => {
  it("TC-F15-04 [AC-F15-02] a blocked chat's call buttons are off and say why", async () => {
    await open({ ...item, readOnly: true, readOnlyReason: "blocked" });
    for (const button of [video(), audio()]) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "You can't call in this chat.");
    }
  });

  it("TC-F15-04 [AC-F15-02] a chat still waiting for acceptance has its call buttons off with the reason", async () => {
    await open({ ...item, request: "waiting" });
    for (const button of [video(), audio()]) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "You can call once they accept your chat request.");
    }
  });

  it("TC-F15-04 [AC-F15-02] in a normal chat both buttons are on", async () => {
    await open(item);
    expect(video()).toBeEnabled();
    expect(audio()).toBeEnabled();
  });

  it("TC-F15-57 [AC-F15-18] while the start request waits the buttons are off, and one press sends one request", async () => {
    let finish: (value: Response) => void = () => undefined;
    const api = await open(item, {
      [START]: () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    });
    await userEvent.click(video());
    await waitFor(() => expect(video()).toBeDisabled());
    expect(audio()).toBeDisabled();
    expect(api.callsTo("POST", `/api/v1/conversations/${CHAT}/calls`)).toHaveLength(1);
    expect(api.callsTo("POST", `/api/v1/conversations/${CHAT}/calls`)[0]?.body).toEqual({ media: "video" });
    finish(json(JOINED));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/call"));
  });

  it("TC-F15-57 [AC-F15-18] a failed start says so with Retry; Retry asks again and then opens the call", async () => {
    let fail = true;
    const api = await open(item, { [START]: () => (fail ? json({ error: { code: "INTERNAL" } }, 500) : json(JOINED)) });
    await userEvent.click(audio());
    const failure = (await screen.findByText("Couldn't start the call.")).parentElement as HTMLElement;
    expect(screen.getByTestId("where")).not.toHaveTextContent("/call");
    fail = false;
    await userEvent.click(within(failure.parentElement ?? failure).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/call"));
    const sent = api.callsTo("POST", `/api/v1/conversations/${CHAT}/calls`);
    expect(sent).toHaveLength(2);
    expect(sent[1]?.body).toEqual({ media: "audio" });
    expect(useChatCall.getState().call).toMatchObject({ phase: "ringing", media: "audio", callId: CALL_ID });
  });

  it('TC-F15-57 [AC-F15-18] a full call says "This call is full."', async () => {
    await open(item, { [START]: () => refuse("CALL_FULL", 409) });
    await userEvent.click(video());
    expect(await screen.findByText("This call is full.")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't start the call.")).not.toBeInTheDocument();
  });

  it("TC-F15-06 [AC-F15-03] while a call runs Join replaces the buttons, and pressing it joins that call", async () => {
    const api = await open(item, {
      [RUNNING]: () => json({ call: { callId: CALL_ID, media: "video", startedAt: new Date().toISOString() } }),
      [`POST ${JOIN}`]: () => json({ ...JOINED }),
    });
    const join = await screen.findByRole("button", { name: "Join" });
    expect(screen.queryByRole("button", { name: "Video call" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Audio call" })).not.toBeInTheDocument();
    await userEvent.click(join);
    await waitFor(() => expect(api.callsTo("POST", JOIN)).toHaveLength(1));
    expect(api.callsTo("POST", `/api/v1/conversations/${CHAT}/calls`)).toHaveLength(0);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/call"));
    expect(useChatCall.getState().call?.phase).toBe("in_call");
  });

  it('TC-F15-06 [AC-F15-03] a failed join says "Couldn\'t join the call."', async () => {
    await open(item, {
      [RUNNING]: () => json({ call: { callId: CALL_ID, media: "audio", startedAt: new Date().toISOString() } }),
      [`POST ${JOIN}`]: () => json({ error: { code: "INTERNAL" } }, 500),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Join" }));
    expect(await screen.findByText("Couldn't join the call.")).toBeInTheDocument();
  });
});
