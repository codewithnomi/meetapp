// The Calling screen of a chat call (F15 T13): who is being called, Cancel, and the outcomes the live line
// brings (declined, no answer) with Call again and Back to chat; a missing camera does not stop the screen.
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT } from "../../features/auth/fake-auth.tsx";
import { useChatCall } from "../../features/calls/index.ts";
import { LiveLineProvider } from "../../features/chats/index.ts";
import { stubNoDevices, VISIT } from "../../features/meetings/fake-visit.ts";
import { useVisit } from "../../features/meetings/index.ts";
import { fakeApi, json, noContent } from "../../features/workspaces/fake-api.ts";
import { ChatCallPage } from "./ChatCallPage.tsx";

class FakeSocket {
  static all: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.all.push(this);
  }
  send() {}
  close() {
    this.readyState = 3;
  }
}

const CALL_ID = "00000000-0000-4000-8000-0000000000d1";
const CHAT = "00000000-0000-4000-8000-0000000000c1";
const CALL = { callId: CALL_ID, serverUrl: "ws://127.0.0.1:7880", pass: "p", role: "organizer" as const };

function ringing(media: "video" | "audio") {
  useVisit.getState().start({ ...VISIT, status: "in_call", title: "Bilal Ahmed", call: CALL });
  useChatCall
    .getState()
    .begin({ callId: CALL_ID, conversationId: CHAT, media, title: "Bilal Ahmed", oneToOne: true, phase: "ringing" });
}

function show(onBackToChat = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LiveLineProvider>
          <ChatCallPage onBackToChat={onBackToChat} onOutcome={vi.fn()} />
        </LiveLineProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onBackToChat;
}

const socket = () => FakeSocket.all.at(-1) as FakeSocket;
const hear = (message: object) =>
  act(() => {
    socket().readyState = 1;
    socket().onopen?.();
    socket().onmessage?.({ data: JSON.stringify(message) });
  });
const stop = (reason: string, callId = CALL_ID) => hear({ t: "ring_stop", callId, reason });

beforeEach(() => {
  FakeSocket.all = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  installFakeAuth(PAT);
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  useChatCall.getState().end();
  useVisit.getState().end();
  vi.unstubAllGlobals();
});

describe("the Calling screen", () => {
  it("TC-F15-23 [AC-F15-07] while ringing it shows who is called and Cancel", async () => {
    stubNoDevices();
    fakeApi();
    ringing("audio");
    show();
    expect(await screen.findByText("Calling Bilal Ahmed…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it('TC-F15-23 [AC-F15-08] a declined call says "Bilal Ahmed declined" with Call again and Back to chat', async () => {
    stubNoDevices();
    fakeApi();
    ringing("audio");
    const back = show();
    await screen.findByText("Calling Bilal Ahmed…");
    stop("declined");
    expect(await screen.findByText("Bilal Ahmed declined")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Call again" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to chat" }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("T-fix-9 [AC-F15-19] if the No answer message is lost, the 5-second check still shows No answer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      stubNoDevices();
      fakeApi({ [`/api/v1/conversations/${CHAT}/call`]: () => json({ call: null }) });
      ringing("audio");
      show();
      await screen.findByText("Calling Bilal Ahmed…");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      expect(await screen.findByText("No answer")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('TC-F15-23 [AC-F15-09] an unanswered call says "No answer"', async () => {
    stubNoDevices();
    fakeApi();
    ringing("audio");
    show();
    await screen.findByText("Calling Bilal Ahmed…");
    stop("missed");
    expect(await screen.findByText("No answer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Call again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to chat" })).toBeInTheDocument();
  });

  it("TC-F15-23 [AC-F15-07] news about another call does not move this screen", async () => {
    stubNoDevices();
    fakeApi();
    ringing("audio");
    show();
    await screen.findByText("Calling Bilal Ahmed…");
    stop("declined", "00000000-0000-4000-8000-0000000000ee");
    expect(screen.getByText("Calling Bilal Ahmed…")).toBeInTheDocument();
  });

  it("TC-F15-23 [AC-F15-07] Call again starts the call again with the same kind", async () => {
    stubNoDevices();
    const api = fakeApi({
      [`POST /api/v1/conversations/${CHAT}/calls`]: () => json({ error: { code: "INTERNAL" } }, 500),
    });
    ringing("audio");
    show();
    await screen.findByText("Calling Bilal Ahmed…");
    stop("declined");
    await userEvent.click(await screen.findByRole("button", { name: "Call again" }));
    await waitFor(() => expect(api.callsTo("POST", `/api/v1/conversations/${CHAT}/calls`)).toHaveLength(1));
    expect(api.callsTo("POST", `/api/v1/conversations/${CHAT}/calls`)[0]?.body).toEqual({ media: "audio" });
  });

  it("TC-F15-23 [AC-F15-07] Cancel stops the ringing, leaves the call and goes back to the chat", async () => {
    stubNoDevices();
    const api = fakeApi({
      [`DELETE /api/v1/calls/${CALL_ID}/ring`]: noContent,
      [`DELETE /api/v1/attendances/${VISIT.attendanceId}`]: noContent,
    });
    ringing("audio");
    const back = show();
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(back).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.callsTo("DELETE", `/api/v1/calls/${CALL_ID}/ring`)).toHaveLength(1));
    await waitFor(() => expect(api.callsTo("DELETE", `/api/v1/attendances/${VISIT.attendanceId}`)).toHaveLength(1));
    expect(useChatCall.getState().call).toBeUndefined();
    expect(useVisit.getState().visit).toBeUndefined();
  });

  it("TC-F15-23 [AC-F15-07] a call cancelled from another window of the same person leaves the screen", async () => {
    stubNoDevices();
    fakeApi({ [`DELETE /api/v1/attendances/${VISIT.attendanceId}`]: noContent });
    ringing("audio");
    const back = show();
    await screen.findByText("Calling Bilal Ahmed…");
    stop("cancelled");
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
  });

  it("TC-F15-60 [AC-F15-27] a video call with no camera still shows the calling screen with the camera problem", async () => {
    stubNoDevices();
    fakeApi();
    ringing("video");
    show();
    expect(await screen.findByText("Calling Bilal Ahmed…")).toBeInTheDocument();
    expect(await screen.findByText("No camera found. Plug one in, or join without video.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
