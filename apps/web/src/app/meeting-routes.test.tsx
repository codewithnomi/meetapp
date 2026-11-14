// The pre-join during a call (F17 TC-F17-33, 32; AC-F17-11, 12, 13): the meeting the person is already in
// shows full instead; another meeting shows its pre-join with the note and "Leave call and join".
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useVisit, type Joined, type PreJoinState } from "../features/meetings/index.ts";
import { memberMeetingRoutes } from "./meeting-routes.tsx";

vi.mock("../pages/PreJoinPage/index.ts", () => ({
  PreJoinPage: ({ meeting, inCall }: { meeting: PreJoinState; inCall?: string }) => (
    <main>
      <h1>{meeting.title}</h1>
      {inCall ? <p>In {inCall}</p> : null}
    </main>
  ),
}));

const visit: Joined = {
  attendanceId: "00000000-0000-4000-8000-000000000001",
  status: "admitted",
  title: "Design review",
  group: "member",
  ticket: "t",
};
const X = JSON.stringify({ link: "https://meet.example/m/AAAA" });
const Y = JSON.stringify({ link: "https://meet.example/m/BBBB" });

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function open(meeting: PreJoinState) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/meeting/pre-join", state: meeting }]}>
      <Routes>{memberMeetingRoutes({ home: "/meetings", join: "/meetings", userName: "Mo" })}</Routes>
      <Where />
    </MemoryRouter>,
  );
}

afterEach(() => useVisit.getState().end());

describe("pre-join during a call", () => {
  it("TC-F17-33 [AC-F17-13] the meeting the person is in shows full, no pre-join", () => {
    useVisit.getState().start(visit, X);
    open({ title: "Design review", lookupToken: "l", group: "member", address: X });
    expect(screen.getByTestId("where")).toHaveTextContent("/meeting/call");
    expect(screen.queryByRole("heading", { name: "Design review" })).toBeNull();
  });

  it("TC-F17-33 [AC-F17-11] another meeting shows its pre-join, told about the current call", () => {
    useVisit.getState().start(visit, X);
    open({ title: "Planning", lookupToken: "l", group: "member", address: Y });
    expect(screen.getByRole("heading", { name: "Planning" })).toBeInTheDocument();
    expect(screen.getByText("In Design review")).toBeInTheDocument();
  });

  it("TC-F17-33 [AC-F17-11] without a call the pre-join has no note", () => {
    open({ title: "Planning", lookupToken: "l", group: "member", address: Y });
    expect(screen.queryByText(/^In /)).toBeNull();
  });
});
