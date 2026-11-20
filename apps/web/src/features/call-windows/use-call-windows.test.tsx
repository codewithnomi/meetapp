// The main window's side of F16's small windows (TC-F16-06, 17, 24, 35): it reports rings and missed
// calls, and carries out the small windows' presses with the app's own code. The desktop bridge is fake.
import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT } from "../auth/fake-auth.tsx";
import { IncomingCalls, useChatCall, useIncomingCalls } from "../calls/index.ts";
import { LiveLineProvider } from "../chats/index.ts";
import { VISIT } from "../meetings/fake-visit.ts";
import { useVisit } from "../meetings/index.ts";
import { fakeApi, json, noContent } from "../workspaces/fake-api.ts";
import { useCallScreen } from "./call-screen.ts";
import { useCallWindows } from "./use-call-windows.ts";

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
const RING = {
  t: "ring",
  callId: CALL_ID,
  conversationId: CHAT,
  from: { userId: "00000000-0000-4000-8000-0000000000a1", name: "Omar Khan", photoUrl: null },
  media: "video",
  groupName: null,
  expiresAt: new Date(Date.now() + 30_000).toISOString(),
};
const CALL = { callId: CALL_ID, serverUrl: "ws://127.0.0.1:7880", pass: "p", role: "presenter" as const };

let press: (action: unknown) => void = () => undefined;
const report = vi.fn();

/** As in the app (router.tsx Ringing): the in-app incoming calls keep the ring list, the watcher reports it. */
function Watcher({ toCall, toChat }: { toCall: () => void; toChat: () => void }) {
  useCallWindows({ toCall, toChat, toPath: vi.fn() });
  return <IncomingCalls onAccepted={toCall} />;
}

function show() {
  const routes = { toCall: vi.fn(), toChat: vi.fn() };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LiveLineProvider>
        <Watcher {...routes} />
      </LiveLineProvider>
    </QueryClientProvider>,
  );
  return routes;
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
  report.mockReset();
  installFakeAuth(PAT);
  vi.stubGlobal("WebSocket", FakeSocket);
  (window as { meetapp?: unknown }).meetapp = {
    callWindows: {
      report,
      onAction: (listener: (action: unknown) => void) => {
        press = listener;
        return () => undefined;
      },
    },
  };
});
afterEach(() => {
  useIncomingCalls.setState({ rings: [], silenced: [] });
  useCallScreen.getState().clear();
  useChatCall.getState().end();
  useVisit.getState().end();
  delete (window as { meetapp?: unknown }).meetapp;
  vi.unstubAllGlobals();
});

describe("the main window and the small windows", () => {
  it("TC-F16-17 [AC-F16-08] a ring is reported at once", async () => {
    show();
    await hear(RING);
    await waitFor(() => expect(report.mock.calls.at(-1)?.[0].rings).toHaveLength(1));
  });

  it("TC-F16-06 [AC-F16-03, AC-F16-07] accept from a ring window: accepted first, then the meeting is left", async () => {
    const { calls: api } = fakeApi({
      [`DELETE /api/v1/attendances/${VISIT.attendanceId}`]: noContent,
      [`POST /api/v1/calls/${CALL_ID}/accept`]: () =>
        json({ ...VISIT, attendanceId: "00000000-0000-4000-8000-0000000000e2", status: "in_call", call: CALL }),
    });
    useVisit.getState().start({ ...VISIT, status: "in_call", title: "Design review" });
    const routes = show();
    await hear(RING);
    await waitFor(() => expect(report.mock.calls.at(-1)?.[0].rings[0]?.busyIn).toBe("Design review"));
    act(() => press({ name: "accept", callId: CALL_ID, video: false }));
    await waitFor(() => expect(routes.toCall).toHaveBeenCalled());
    const paths = api.map((c) => `${c.method} ${c.path}`);
    expect(paths.indexOf(`POST /api/v1/calls/${CALL_ID}/accept`)).toBeLessThan(
      paths.indexOf(`DELETE /api/v1/attendances/${VISIT.attendanceId}`),
    );
    expect(useChatCall.getState().call).toMatchObject({ callId: CALL_ID, media: "audio" });
  });

  it("TC-F16-09 [AC-F16-04] × silences the ring here; decline tells the backend", async () => {
    const { calls: api } = fakeApi({ [`POST /api/v1/calls/${CALL_ID}/decline`]: noContent });
    show();
    await hear(RING);
    act(() => press({ name: "hide", callId: CALL_ID }));
    expect(useIncomingCalls.getState().silenced).toEqual([CALL_ID]);
    expect(useIncomingCalls.getState().rings).toHaveLength(1);
    act(() => press({ name: "decline", callId: CALL_ID }));
    await waitFor(() => expect(api.some((c) => c.path.endsWith("/decline"))).toBe(true));
  });

  it("TC-F16-35 [AC-F16-16] call buttons run the call screen's own handlers; a locked mic can't be unmuted", () => {
    const controls = { toggleMic: vi.fn(), toggleCamera: vi.fn(), share: vi.fn(), toggleHand: vi.fn(), leave: vi.fn() };
    const call = {
      title: "Release team",
      joinedAt: 0,
      people: 2,
      phase: "in-call" as const,
      speaker: { name: "Sara", initials: "S", hasVideo: false, sharing: false },
      mic: false,
      camera: true,
      hand: false,
      canUnmute: false,
      canShare: true,
    };
    useCallScreen.getState().publish(call, controls);
    show();
    for (const name of ["toggleMic", "toggleCamera", "share", "toggleHand", "leave", "backToCall"])
      act(() => press({ name }));
    expect(controls.toggleMic).not.toHaveBeenCalled();
    for (const handler of [controls.toggleCamera, controls.share, controls.toggleHand, controls.leave])
      expect(handler).toHaveBeenCalledOnce();
    useCallScreen.getState().publish({ ...call, canUnmute: true }, controls);
    act(() => press({ name: "toggleMic" }));
    expect(controls.toggleMic).toHaveBeenCalledOnce();
  });

  it("TC-F16-32 [AC-F16-16] a call screen that redraws all the time still gets fresh reports out", async () => {
    const controls = { toggleMic: vi.fn(), toggleCamera: vi.fn(), share: vi.fn(), toggleHand: vi.fn(), leave: vi.fn() };
    const call = (mic: boolean) => ({
      title: "Release team",
      joinedAt: 0,
      people: 2,
      phase: "in-call" as const,
      speaker: { name: "Sara", initials: "S", hasVideo: false, sharing: false },
      mic,
      camera: false,
      hand: false,
      canUnmute: true,
      canShare: true,
    });
    show();
    let mic = false;
    for (let i = 0; i < 14; i += 1) {
      mic = !mic;
      act(() => useCallScreen.getState().publish(call(mic), controls));
      await new Promise((done) => setTimeout(done, 50));
    }
    await waitFor(() => expect(report.mock.calls.at(-1)?.[0].call?.mic).toBe(mic));
    expect(report.mock.calls.filter(([r]) => r.call !== null).length).toBeGreaterThanOrEqual(3);
  });

  it("TC-F16-20 [AC-F16-10, AC-F16-12] TC-F16-22 an unanswered ring is reported as missed once; answered, declined or cancelled ones aren't", async () => {
    show();
    await hear(RING);
    await hear({ t: "ring_stop", callId: CALL_ID, reason: "missed" });
    await waitFor(() => expect(report.mock.calls.some(([r]) => r.missed.length === 1)).toBe(true));
    const missed = report.mock.calls.find(([r]) => r.missed.length === 1)?.[0].missed[0];
    expect(missed).toMatchObject({ callId: CALL_ID, from: "Omar Khan", conversationId: CHAT });
    report.mockReset();
    // TC-F16-22: answered, declined and cancelled calls are never missed calls.
    for (const [n, reason] of [
      ["2", "accepted"],
      ["3", "declined"],
      ["4", "cancelled"],
    ] as const) {
      const callId = `00000000-0000-4000-8000-0000000000d${n}`;
      await hear({ ...RING, callId });
      await hear({ t: "ring_stop", callId, reason });
    }
    await waitFor(() => expect(report).toHaveBeenCalled());
    expect(report.mock.calls.every(([r]) => r.missed.length === 0)).toBe(true);
  });

  it("TC-F16-68 [AC-F16-10, AC-F16-12] a caller who hangs up before anyone answers gives a missed call (D081)", async () => {
    show();
    await hear(RING);
    await hear({ t: "ring_stop", callId: CALL_ID, reason: "cancelled", missedCall: true });
    await waitFor(() => expect(report.mock.calls.some(([r]) => r.missed.length === 1)).toBe(true));
    expect(report.mock.calls.find(([r]) => r.missed.length === 1)?.[0].missed[0]).toMatchObject({ callId: CALL_ID });
  });

  it("TC-F16-24 [AC-F16-11] Call back that can't start opens the chat instead", async () => {
    fakeApi({ [`POST /api/v1/conversations/${CHAT}/calls`]: () => json({ error: { code: "CHAT_READ_ONLY" } }, 403) });
    const routes = show();
    act(() => press({ name: "callBack", conversationId: CHAT, video: true }));
    await waitFor(() => expect(routes.toChat).toHaveBeenCalled());
    expect(useChatCall.getState().backTo).toBe(CHAT);
    expect(useChatCall.getState().call).toBeUndefined();
  });

  it("TC-F16-25 [AC-F16-11] clicking the notification opens that chat", () => {
    const routes = show();
    act(() => press({ name: "openChat", conversationId: CHAT }));
    expect(useChatCall.getState().backTo).toBe(CHAT);
    expect(routes.toChat).toHaveBeenCalled();
  });
});
