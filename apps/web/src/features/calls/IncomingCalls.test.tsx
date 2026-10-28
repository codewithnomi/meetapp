// The app-wide incoming call (F15 T14): a ring shows it, ring_stop removes it, Decline tells the backend,
// and accepting during a meeting leaves the meeting first, then opens the call.
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT } from "../auth/fake-auth.tsx";
import { LiveLineProvider } from "../chats/index.ts";
import { VISIT } from "../meetings/fake-visit.ts";
import { useVisit } from "../meetings/index.ts";
import { fakeApi, json, noContent } from "../workspaces/fake-api.ts";
import { useChatCall } from "./chat-call.ts";
import { IncomingCalls } from "./IncomingCalls.tsx";
import { useIncomingCalls } from "./incoming-calls.ts";

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
const RING = {
  t: "ring",
  callId: CALL_ID,
  conversationId: "00000000-0000-4000-8000-0000000000c1",
  from: { userId: "00000000-0000-4000-8000-0000000000a1", name: "Omar Khan", photoUrl: null },
  media: "video",
  groupName: "Release team",
  expiresAt: new Date(Date.now() + 30_000).toISOString(),
};
const CALL = { callId: CALL_ID, serverUrl: "ws://127.0.0.1:7880", pass: "p", role: "presenter" as const };

function show(onAccepted = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LiveLineProvider>
        <IncomingCalls onAccepted={onAccepted} />
      </LiveLineProvider>
    </QueryClientProvider>,
  );
  return onAccepted;
}

const hear = (message: object) =>
  act(() => {
    const socket = FakeSocket.all.at(-1) as FakeSocket;
    socket.readyState = 1;
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify(message) });
  });

beforeEach(() => {
  FakeSocket.all = [];
  installFakeAuth(PAT);
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  useIncomingCalls.setState({ rings: [] });
  useChatCall.getState().end();
  useVisit.getState().end();
  vi.unstubAllGlobals();
});

describe("the incoming call", () => {
  it("TC-F15-09 [AC-F15-05] a ring shows the caller and the group; ring_stop removes it", async () => {
    fakeApi({ "/api/v1/me/settings": () => json({ ringtone: 4, ringVolume: 50, readReceipts: true }) });
    show();
    await hear(RING);
    expect(await screen.findByRole("alertdialog", { name: "Incoming call" })).toBeInTheDocument();
    expect(screen.getByText("Omar Khan")).toBeInTheDocument();
    expect(screen.getByText("Video call · Release team")).toBeInTheDocument();
    await hear({ t: "ring_stop", callId: CALL_ID, reason: "accepted" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("TC-F15-15 [AC-F15-07] Decline tells the backend and closes the window", async () => {
    const { calls: api } = fakeApi({ [`POST /api/v1/calls/${CALL_ID}/decline`]: noContent });
    show();
    await hear(RING);
    await userEvent.click(await screen.findByRole("button", { name: "Decline" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(api.some((c) => c.path.endsWith("/decline"))).toBe(true));
  });

  it("TC-F15-25 [AC-F15-10] during a meeting, accepting joins the call, then leaves the meeting", async () => {
    const { calls: api } = fakeApi({
      [`DELETE /api/v1/attendances/${VISIT.attendanceId}`]: noContent,
      [`POST /api/v1/calls/${CALL_ID}/accept`]: () =>
        json({ ...VISIT, attendanceId: "00000000-0000-4000-8000-0000000000e2", status: "in_call", call: CALL }),
    });
    useVisit.getState().start({ ...VISIT, status: "in_call", title: "Design review" });
    const accepted = show();
    await hear(RING);
    expect(await screen.findByText("You're in Design review. Accepting leaves it.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Leave current call and accept with audio" }));
    await waitFor(() => expect(accepted).toHaveBeenCalledTimes(1));
    const paths = api.map((c) => `${c.method} ${c.path}`);
    // Accepted first, then the meeting is left: a failed accept never drops the person (T-fix-3).
    expect(paths.indexOf(`POST /api/v1/calls/${CALL_ID}/accept`)).toBeLessThan(
      paths.indexOf(`DELETE /api/v1/attendances/${VISIT.attendanceId}`),
    );
    expect(paths).toContain(`DELETE /api/v1/attendances/${VISIT.attendanceId}`);
    expect(useChatCall.getState().call).toMatchObject({ callId: CALL_ID, media: "audio", phase: "in_call" });
  });

  it("T-fix-3 [AC-F15-10] a failed accept keeps the meeting and the ring, to try again", async () => {
    const { calls: api } = fakeApi({
      [`POST /api/v1/calls/${CALL_ID}/accept`]: () => json({ error: { code: "CALL_FULL" } }, 409),
    });
    useVisit.getState().start({ ...VISIT, status: "in_call", title: "Design review" });
    show();
    await hear(RING);
    await userEvent.click(await screen.findByRole("button", { name: "Leave current call and accept with video" }));
    expect(await screen.findByText("Couldn't join the call.")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "Incoming call" })).toBeInTheDocument();
    expect(api.some((c) => c.method === "DELETE")).toBe(false);
    expect(useVisit.getState().visit?.title).toBe("Design review");
  });
});
