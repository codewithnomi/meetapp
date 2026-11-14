// useCurrentCall (F17 TC-F17-21, AC-F17-08): which call this window is in and the path that shows it
// full, from a meeting visit, a lobby visit or a chat call; nothing without a call or once it ended.
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useVisit, type Joined } from "../meetings/index.ts";
import { useChatCall, type ChatCall } from "./chat-call.ts";
import { useCallOutcome, useCurrentCall } from "./current-call.ts";

const visit = (status: Joined["status"]): Joined => ({
  attendanceId: "00000000-0000-4000-8000-000000000001",
  status,
  title: "Design review",
  group: "member",
  ticket: "t",
});

const chat = (phase: ChatCall["phase"]): ChatCall => ({
  callId: "c1",
  conversationId: "conv1",
  media: "video",
  title: "Release team",
  oneToOne: false,
  phase,
});

afterEach(() => {
  useVisit.getState().end();
  useChatCall.setState({ call: undefined });
  useCallOutcome.getState().clear();
});

const current = () => renderHook(() => useCurrentCall()).result.current;

describe("useCurrentCall", () => {
  it("TC-F17-21 [AC-F17-08] a meeting, a lobby, a chat call, and nothing without a call", () => {
    expect(current()).toBeUndefined();
    useVisit.getState().start(visit("admitted"));
    expect(current()).toEqual({ kind: "meeting", title: "Design review", fullPath: "/meeting/call" });
    useVisit.getState().start(visit("waiting"));
    expect(current()).toEqual({ kind: "meeting", title: "Design review", fullPath: "/meeting/lobby" });
    useVisit.getState().start(visit("admitted"));
    useChatCall.setState({ call: chat("in_call") });
    expect(current()).toEqual({ kind: "chat", conversationId: "conv1", title: "Release team", fullPath: "/call" });
    useChatCall.setState({ call: chat("ringing") });
    expect(current()?.fullPath).toBe("/call");
  });

  it("TC-F17-21 [AC-F17-08] a visit kept for Rejoin after the call ended is no current call", () => {
    useVisit.getState().start(visit("admitted"));
    useCallOutcome.getState().set({ ...visit("left"), leftReason: "dropped" });
    expect(current()).toBeUndefined();
    useVisit.getState().start(visit("left"));
    useCallOutcome.getState().clear();
    expect(current()).toBeUndefined();
  });
});
