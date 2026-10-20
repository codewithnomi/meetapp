// MeetingPage with a stand-in for the call server: TC-F02-90 (AC-F02-45), the screen while connecting
// and while reconnecting, and what happens when the call drops and the backend can't be asked why.
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { VISIT } from "../../features/meetings/fake-visit.ts";
import { useVisit } from "../../features/meetings/index.ts";
import { fakeApi } from "../../features/workspaces/fake-api.ts";
import { MeetingPage } from "./MeetingPage.tsx";

const room = vi.hoisted(() => ({
  connection: "connecting",
  onDisconnected: undefined as undefined | (() => void),
}));

vi.mock("../../features/meetings/index.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/meetings/index.ts")>();
  const none = async () => undefined;
  return {
    ...actual,
    useMeetingRoom: (_visit: unknown, _prefs: unknown, handlers: { onDisconnected: () => void }) => {
      room.onDisconnected = handlers.onDisconnected;
      return {
        room: undefined,
        people: [],
        connection: room.connection,
        may: { microphone: true, camera: true, screen: true },
        state: { locked: false, options: undefined, endsAt: undefined },
        share: none,
        stopShare: none,
        setMicrophone: none,
        setCamera: none,
        sendReaction: none,
      };
    },
  };
});

const CALL = { callId: "call-1", serverUrl: "ws://127.0.0.1:7880", pass: "pass-1", role: "organizer" as const };
beforeEach(() => {
  installFakeAuth(PAT);
  room.connection = "connecting";
  useVisit.getState().start({ ...VISIT, status: "in_call", call: CALL });
});
afterEach(() => {
  useVisit.getState().end();
  vi.unstubAllGlobals();
});

const open = (onOutcome = vi.fn()) => {
  renderWithApp(<MeetingPage onLeft={vi.fn()} onOutcome={onOutcome} />);
  return onOutcome;
};

describe("TC-F02-90 meeting screen states", () => {
  it("TC-F02-90 [AC-F02-45] while connecting the controls and the title are there and no error shows", () => {
    fakeApi();
    open();
    expect(screen.getByRole("group", { name: "Meeting controls" })).toBeInTheDocument();
    expect(screen.getByText("Budget review")).toBeInTheDocument();
    expect(screen.queryByText("Reconnecting…")).not.toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] while the call reconnects it says so", () => {
    fakeApi();
    room.connection = "reconnecting";
    open();
    expect(screen.getByText("Reconnecting…")).toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] a call that drops while MeetApp can't be reached ends as a lost connection", async () => {
    fakeApi({
      [`GET /api/v1/attendances/${VISIT.attendanceId}`]: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const onOutcome = open();
    room.onDisconnected?.();
    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith(expect.objectContaining({ leftReason: "dropped" })));
  });

  it("TC-F02-90 [AC-F02-45] shows nothing without a visit", () => {
    useVisit.getState().end();
    fakeApi();
    open();
    expect(screen.queryByRole("group", { name: "Meeting controls" })).not.toBeInTheDocument();
  });
});
