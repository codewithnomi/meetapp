// CalendarPage with a stubbed backend (F13 AC-F13-01, 03, 05, 24, 32): opens on the work week, the views
// and Today, only the open workspace, the empty hint, the details panel, offline, and keyboard use.
import { act, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { CurrentWorkspaceProvider } from "../../features/workspaces/index.ts";
import { fakeApi, IDS, json } from "../../features/workspaces/fake-api.ts";
import { CalendarPage } from "./CalendarPage.tsx";

/** Wednesday 25 November 2026, 10:20 on this computer. */
const NOW = new Date(2026, 10, 25, 10, 20);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).toISOString();
const ORGANIZER = { id: "00000000-0000-4000-8000-0000000000aa", name: "Olivia Owner" };
const MEETING = "00000000-0000-4000-8000-0000000000b1";

const occurrence = (title: string, day: number, hour: number, extra: object = {}) => ({
  meetingId: `00000000-0000-4000-8000-0000000000${String(day).padStart(2, "0")}`,
  originalStart: at(day, hour),
  startsAt: at(day, hour),
  endsAt: at(day, hour, 30),
  allDay: false,
  title,
  organizer: ORGANIZER,
  repeats: false,
  myAnswer: "accepted",
  canJoin: false,
  ...extra,
});

const WEEK = [occurrence("Monday sync", 23, 9), occurrence("Saturday thing", 28, 11)];
const calendarPath = (workspaceId: string) => `/api/v1/workspaces/${workspaceId}/calendar`;
const calendarUrls = () =>
  vi
    .mocked(fetch)
    .mock.calls.map(([input]) => new URL(String(input)))
    .filter((url) => url.pathname.endsWith("/calendar"));

beforeEach(() => {
  installFakeAuth(PAT);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

function open() {
  renderWithApp(
    <CurrentWorkspaceProvider>
      <CalendarPage onNavigate={vi.fn()} onPreJoin={vi.fn()} now={() => NOW} />
    </CurrentWorkspaceProvider>,
  );
}

describe("the calendar", () => {
  it("TC-F13-18 [AC-F13-01] opens on the work week: five days, meetings at their time; the weekend isn't shown", async () => {
    fakeApi({ [calendarPath(IDS.aria)]: () => json({ occurrences: WEEK, truncated: false }) });
    open();
    expect(await screen.findByRole("button", { name: /^Monday sync, / })).toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: /November/ })).toHaveLength(5);
    expect(screen.getByRole("button", { name: /^Monday sync, .*Olivia Owner/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Saturday thing/ })).not.toBeInTheDocument();
    const [url] = calendarUrls();
    expect(new Date(url?.searchParams.get("from") ?? "")).toEqual(new Date(2026, 10, 23));
    expect(new Date(url?.searchParams.get("to") ?? "")).toEqual(new Date(2026, 10, 28));
  });

  it("TC-F13-19 [AC-F13-01] Day, Week, Month, back, forward and Today; the view is remembered", async () => {
    fakeApi({ [calendarPath(IDS.aria)]: () => json({ occurrences: [], truncated: false }) });
    open();
    const last = () => {
      const url = calendarUrls().at(-1);
      return [new Date(url?.searchParams.get("from") ?? ""), new Date(url?.searchParams.get("to") ?? "")];
    };
    await userEvent.click(await screen.findByRole("radio", { name: "Day" }));
    await vi.waitFor(() => expect(last()).toEqual([new Date(2026, 10, 25), new Date(2026, 10, 26)]));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await vi.waitFor(() => expect(last()[0]).toEqual(new Date(2026, 10, 26)));
    await userEvent.click(screen.getByRole("radio", { name: "Week" }));
    await vi.waitFor(() => expect(last()).toEqual([new Date(2026, 10, 23), new Date(2026, 10, 30)]));
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    await vi.waitFor(() => expect(last()[0]).toEqual(new Date(2026, 10, 16)));
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    await vi.waitFor(() => expect(last()[0]).toEqual(new Date(2026, 10, 23)));
    await userEvent.click(screen.getByRole("radio", { name: "Month" }));
    await vi.waitFor(() => expect(last()).toEqual([new Date(2026, 9, 26), new Date(2026, 11, 7)]));
    expect(localStorage.getItem("meetapp:calendar-view")).toBe("month");
  });

  it("TC-F13-20 [AC-F13-01] asks only for the open workspace's meetings", async () => {
    fakeApi({ [calendarPath(IDS.aria)]: () => json({ occurrences: WEEK, truncated: false }) });
    open();
    await screen.findByRole("button", { name: /^Monday sync/ });
    expect(calendarUrls().every((url) => url.pathname === calendarPath(IDS.aria))).toBe(true);
  });

  it("TC-F13-25 [AC-F13-01] with no meetings, the hint says how to schedule one", async () => {
    fakeApi({ [calendarPath(IDS.aria)]: () => json({ occurrences: [], truncated: false }) });
    open();
    expect(await screen.findByText("No meetings. Select New meeting to schedule one.")).toBeInTheDocument();
  });
});

describe("a meeting's details", () => {
  const details = {
    meetingId: MEETING,
    title: "Weekly planning",
    description: "Board: https://plan.example.com/week",
    startsAt: at(25, 10),
    endsAt: at(25, 10, 30),
    allDay: false,
    timeZone: "Europe/London",
    repeat: { kind: "weekly", days: ["WE"] },
    organizer: ORGANIZER,
    link: "https://meetapp.app/m/Vb3kQ9xLr2TnWp8sYc4dFg",
    meetingNumber: "284615903172",
    passcode: "h3Tq9z",
    invitees: [{ id: MEETING, member: { id: PAT.id, name: PAT.name }, email: null, answer: "none" }],
    hiddenExternal: 1,
    myAnswer: "none",
    canManage: false,
    unsentInvites: 0,
    cancelled: false,
  };
  const now = occurrence("Weekly planning", 25, 10, {
    meetingId: MEETING,
    canJoin: true,
    myAnswer: "none",
    repeats: true,
  });

  it("TC-F13-24 TC-F13-41 [AC-F13-05] [AC-F13-24] a block opens by keyboard; the panel shows Join, the answer and people", async () => {
    const api = fakeApi({
      [calendarPath(IDS.aria)]: () => json({ occurrences: [now], truncated: false }),
      [`/api/v1/meetings/${MEETING}/schedule`]: () => json(details),
      [`PUT /api/v1/meetings/${MEETING}/schedule/answer`]: () => json({}),
    });
    open();
    const block = await screen.findByRole("button", { name: /^Weekly planning, .*No answer$/ });
    block.focus();
    await userEvent.keyboard("{Enter}");
    const panel = await screen.findByRole("complementary", { name: "Weekly planning" });
    expect(within(panel).getByText("Every week")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Join" })).toBeInTheDocument();
    expect(within(panel).getByText("1 person from outside")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "https://plan.example.com/week" })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("radio", { name: "Accept" }));
    await vi.waitFor(() => expect(api.callsTo("PUT", `/api/v1/meetings/${MEETING}/schedule/answer`)).toHaveLength(1));
    expect(api.callsTo("PUT", `/api/v1/meetings/${MEETING}/schedule/answer`)[0]?.body).toEqual({
      answer: "accepted",
      scope: "series",
    });
  });

  it("TC-F13-40 [AC-F13-32] offline: the last calendar stays with a notice and the answer buttons go", async () => {
    fakeApi({
      [calendarPath(IDS.aria)]: () => json({ occurrences: [now], truncated: false }),
      [`/api/v1/meetings/${MEETING}/schedule`]: () => json(details),
    });
    open();
    await userEvent.click(await screen.findByRole("button", { name: /^Weekly planning/ }));
    await screen.findByRole("radio", { name: "Accept" });
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event("offline")));
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Weekly planning/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Accept" })).not.toBeInTheDocument();
    act(() => void window.dispatchEvent(new Event("online")));
    expect(await screen.findByRole("radio", { name: "Accept" })).toBeInTheDocument();
  });
});
