// The call host (F17 design.md 3.1, 3.2; TC-F17-08, 15, 20, 44, 45): the call page stays the same running
// page while the person opens other screens; hidden, it is inert and its callbacks never change the screen;
// a call that ends while hidden leaves a banner instead of the Ended screen. The pages are stand-ins.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCallCorner } from "../features/call-corner/index.ts";
import { useCallScreen } from "../features/call-windows/index.ts";
import { useCallOutcome, useChatCall } from "../features/calls/index.ts";
import { useVisit, type Attendance, type Joined } from "../features/meetings/index.ts";
import { CallHost } from "./CallHost.tsx";

interface Pages {
  onLeft?: () => void;
  onOutcome?: (outcome: Attendance) => void;
  onAdmitted?: () => void;
  onBackToChat?: () => void;
}
const fake = vi.hoisted(() => ({ mounts: 0, last: {} as Pages, preview: [] as boolean[] }));

vi.mock("../pages/MeetingPage/index.ts", () => ({
  MeetingPage: (props: Pages) => {
    fake.last = props;
    const [panel, setPanel] = useState("none");
    useEffect(() => void fake.mounts++, []);
    return (
      <main>
        <h1 tabIndex={-1}>The call</h1>
        <button type="button" onClick={() => setPanel("people")}>
          Open people
        </button>
        <p>Panel: {panel}</p>
      </main>
    );
  },
}));
vi.mock("../pages/LobbyPage/index.ts", () => ({
  LobbyPage: (props: Pages & { previewOn: boolean }) => {
    fake.last = props;
    fake.preview.push(props.previewOn);
    return <main>Lobby</main>;
  },
}));
vi.mock("../pages/ChatCallPage/index.ts", () => ({
  ChatCallPage: (props: Pages) => {
    fake.last = props;
    return <main>Chat call</main>;
  },
}));

const visit = (status: Joined["status"]): Joined => ({
  attendanceId: "00000000-0000-4000-8000-000000000001",
  status,
  title: "Design review",
  group: "member",
  ticket: "t",
});

let go: (path: string) => void = () => undefined;
function Where() {
  const navigate = useNavigate();
  useEffect(() => {
    go = (path) => void navigate(path);
  }, [navigate]);
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function app(at = "/meeting/call") {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route
            path="/chat"
            element={
              <main>
                <h1 tabIndex={-1}>Chat</h1>
              </main>
            }
          />
          <Route path="*" element={null} />
        </Routes>
        <Where />
        <CallHost userName="Mo" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function inCall() {
  useVisit.getState().start(visit("admitted"));
  useCallScreen.getState().publish(
    {
      title: "Design review",
      joinedAt: Date.now(),
      people: 2,
      phase: "in-call",
      speaker: { name: "Sara Malik", initials: "SM", hasVideo: false, sharing: false },
      mic: true,
      camera: false,
      hand: false,
      canUnmute: true,
      canShare: true,
    },
    { toggleMic: vi.fn(), toggleCamera: vi.fn(), share: vi.fn(), toggleHand: vi.fn(), leave: vi.fn() },
  );
}

const where = () => screen.getByTestId("where").textContent;
const host = () => document.querySelector("[data-call-host]");

afterEach(() => {
  useVisit.getState().end();
  useChatCall.setState({ call: undefined });
  useCallOutcome.getState().clear();
  useCallScreen.getState().clear();
  fake.mounts = 0;
  fake.preview = [];
});

describe("CallHost", () => {
  it("TC-F17-08 [AC-F17-03, AC-F17-01] browsing keeps the same call page, its panel, and hides it inert", async () => {
    inCall();
    app();
    await userEvent.click(screen.getByRole("button", { name: "Open people" }));
    act(() => go("/chat"));
    expect(host()).toHaveAttribute("hidden");
    expect(host()).toHaveAttribute("inert");
    expect(screen.getByRole("region", { name: "Call: Design review" })).toBeInTheDocument();
    expect(useCallCorner.getState().taken).toBe(true);
    // The small view's picture brings the full call back, as it was.
    await userEvent.click(screen.getByRole("button", { name: "Go back to the Design review call" }));
    expect(where()).toBe("/meeting/call");
    expect(host()).not.toHaveAttribute("hidden");
    expect(screen.getByText("Panel: people")).toBeInTheDocument();
    expect(fake.mounts).toBe(1);
    expect(screen.queryByRole("region", { name: "Call: Design review" })).toBeNull();
    expect(useCallCorner.getState().taken).toBe(false);
  });

  it("TC-F17-20 [AC-F17-05, 06, 07] the page's callbacks move between screens only while the call is full", () => {
    inCall();
    app();
    act(() => fake.last.onLeft?.());
    expect(where()).toBe("/meetings");
    act(() => go("/meeting/call"));
    act(() => fake.last.onOutcome?.(visit("left")));
    expect(where()).toBe("/meeting/ended");
    act(() => go("/chat"));
    act(() => fake.last.onLeft?.());
    expect(where()).toBe("/chat");
    // Chat call: Back to chat moves only while full.
    useChatCall.setState({
      call: { callId: "c", conversationId: "v", media: "audio", title: "Omar", oneToOne: true, phase: "in_call" },
    });
    act(() => go("/people"));
    act(() => fake.last.onBackToChat?.());
    expect(where()).toBe("/people");
    act(() => go("/call"));
    act(() => fake.last.onBackToChat?.());
    expect(where()).toBe("/chat");
  });

  it("TC-F17-20 [AC-F17-07] being let in while the lobby shows full moves on to the call", () => {
    useVisit.getState().start(visit("waiting"));
    app("/meeting/lobby");
    act(() => useVisit.getState().update(visit("admitted")));
    expect(where()).toBe("/meeting/call");
  });

  it("TC-F17-15 [AC-F17-06] a call that ends while hidden leaves a banner; the screen stays; Rejoin only after a lost connection", async () => {
    inCall();
    app("/chat");
    act(() => fake.last.onOutcome?.({ ...visit("removed"), actedByName: "Olivia" }));
    expect(where()).toBe("/chat");
    expect(host()).toBeNull();
    expect(screen.getByText("Olivia removed you.", { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rejoin" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(useCallOutcome.getState().outcome).toBeUndefined();
    inCall();
    act(() => fake.last.onOutcome?.({ ...visit("left"), leftReason: "dropped" }));
    expect(screen.getByRole("button", { name: "Rejoin" })).toBeInTheDocument();
    expect(where()).toBe("/chat");
  });

  it("TC-F17-45 [AC-F17-07] the lobby's camera preview is off while hidden and back on when shown", () => {
    useVisit.getState().start(visit("waiting"));
    app("/meeting/lobby");
    act(() => go("/meetings"));
    act(() => go("/meeting/lobby"));
    expect(fake.preview[0]).toBe(true);
    expect(fake.preview).toContain(false);
    expect(fake.preview.at(-1)).toBe(true);
  });
});
