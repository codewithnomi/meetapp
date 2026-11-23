// SchedulePage with a stubbed backend (F13 AC-F13-07, 08, 10, 14, 18, 19): filling and sending, invitees
// by name or any email, field errors that stop Send, wait times, and editing one meeting or the series.
import { fireEvent, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { CurrentWorkspaceProvider } from "../../features/workspaces/index.ts";
import { fakeApi, IDS, json, refuse } from "../../features/workspaces/fake-api.ts";
import { SchedulePage, type SchedulePageProps } from "./SchedulePage.tsx";

const NOW = new Date(2026, 10, 25, 10, 20);
const CREATE = `POST /api/v1/workspaces/${IDS.aria}/scheduled-meetings`;
const MEETING = "00000000-0000-4000-8000-0000000000b1";
const SARA = {
  userId: "00000000-0000-4000-8000-0000000000c1",
  name: "Sara Malik",
  photoUrl: null,
  external: false,
  status: null,
};

beforeEach(() => installFakeAuth(PAT));
afterEach(() => vi.unstubAllGlobals());

function open(props: Partial<SchedulePageProps> = {}) {
  const onDone = vi.fn();
  renderWithApp(
    <CurrentWorkspaceProvider>
      <SchedulePage onNavigate={vi.fn()} onDone={onDone} now={() => NOW} {...props} />
    </CurrentWorkspaceProvider>,
  );
  return onDone;
}

describe("New meeting", () => {
  it("TC-F13-26 TC-F13-28 [AC-F13-07] [AC-F13-08] fills, invites a member and an outside email, and sends", async () => {
    const api = fakeApi({
      [CREATE]: () => json({ meetingId: MEETING }, 201),
      [`/api/v1/workspaces/${IDS.aria}/people`]: () => json({ people: [SARA], noAccount: false }),
    });
    const onDone = open();
    await userEvent.type(await screen.findByLabelText("Title"), "Planning");
    expect(screen.getByLabelText("Start time")).toHaveValue("10:30");
    expect(screen.getByLabelText("End time")).toHaveValue("11:00");
    await userEvent.type(screen.getByLabelText("People to invite"), "Sara");
    await userEvent.click(await screen.findByRole("option", { name: /Sara Malik/ }));
    await userEvent.type(screen.getByLabelText("People to invite"), "not-an-email");
    expect(screen.queryByRole("button", { name: /^Add / })).not.toBeInTheDocument();
    api.handlers[`/api/v1/workspaces/${IDS.aria}/people`] = () => json({ people: [], noAccount: true });
    await userEvent.clear(screen.getByLabelText("People to invite"));
    await userEvent.type(screen.getByLabelText("People to invite"), "lena@partner.example");
    await userEvent.click(await screen.findByRole("button", { name: "Add lena@partner.example" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    const body = api.callsTo("POST", `/api/v1/workspaces/${IDS.aria}/scheduled-meetings`)[0]?.body as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      title: "Planning",
      invitees: [{ userId: SARA.userId }, { email: "lena@partner.example" }],
      startsAt: new Date(2026, 10, 25, 10, 30).toISOString(),
      repeat: { kind: "none" },
    });
  });

  it("TC-F13-29 [AC-F13-10] field errors stop Send: each says what's wrong and focus goes to the first", async () => {
    const api = fakeApi({ [CREATE]: () => json({ meetingId: MEETING }, 201) });
    open();
    fireEvent.change(await screen.findByLabelText("End time"), { target: { value: "10:00" } });
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText("Give the meeting a title.")).toBeInTheDocument();
    expect(screen.getByText("The end must be after the start.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveFocus();
    expect(api.callsTo("POST", `/api/v1/workspaces/${IDS.aria}/scheduled-meetings`)).toHaveLength(0);
  });

  it("TC-F13-31 [AC-F13-14] too many emails: the form stays filled and says how long to wait", async () => {
    fakeApi({ [CREATE]: () => json({ error: { code: "TOO_MANY_EMAILS", retryAfterSeconds: 720 } }, 429) });
    const onDone = open();
    await userEvent.type(await screen.findByLabelText("Title"), "Planning");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText("You've sent a lot of meeting emails. Try again in 12 minutes."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Planning");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("TC-F13-27 [AC-F13-07] all day hides the times; a dragged range fills start and end", async () => {
    fakeApi({});
    open({ range: { startsAt: new Date(2026, 10, 26, 14), endsAt: new Date(2026, 10, 26, 15, 30) } });
    expect(await screen.findByLabelText("Start time")).toHaveValue("14:00");
    expect(screen.getByLabelText("End time")).toHaveValue("15:30");
    await userEvent.click(screen.getByRole("switch", { name: "All day" }));
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
  });
});

describe("Edit meeting", () => {
  const details = {
    meetingId: MEETING,
    title: "Weekly planning",
    description: "",
    startsAt: new Date(2026, 10, 25, 10).toISOString(),
    endsAt: new Date(2026, 10, 25, 10, 30).toISOString(),
    allDay: false,
    timeZone: "UTC",
    repeat: { kind: "weekly", days: ["WE"] },
    organizer: { id: PAT.id, name: PAT.name },
    link: "https://meetapp.app/m/x",
    meetingNumber: "284615903172",
    passcode: "h3Tq9z",
    invitees: [],
    hiddenExternal: 0,
    myAnswer: null,
    canManage: true,
    unsentInvites: 0,
    cancelled: false,
  };
  const SCHEDULE = `/api/v1/meetings/${MEETING}/schedule`;

  it("TC-F13-33 [AC-F13-19] moving the series warns that answers reset and sends only after confirming", async () => {
    const api = fakeApi({ [`GET ${SCHEDULE}`]: () => json(details), [`PATCH ${SCHEDULE}`]: () => json({}) });
    const onDone = open({ edit: { meetingId: MEETING, scope: "series" } });
    fireEvent.change(await screen.findByLabelText("Start time"), { target: { value: "11:00" } });
    fireEvent.change(screen.getByLabelText("End time"), { target: { value: "11:30" } });
    await userEvent.click(screen.getByRole("button", { name: "Send update" }));
    expect(await screen.findByRole("dialog", { name: "Change the time of every meeting?" })).toBeInTheDocument();
    expect(api.callsTo("PATCH", SCHEDULE)).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Change and send" }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.callsTo("PATCH", SCHEDULE)[0]?.body).toMatchObject({
      scope: "series",
      repeat: { kind: "weekly", days: ["WE"] },
    });
  });

  it("TC-F13-33 [AC-F13-18] one meeting of a series: only its own fields, with which one", async () => {
    const api = fakeApi({ [`GET ${SCHEDULE}`]: () => json(details), [`PATCH ${SCHEDULE}`]: () => json({}) });
    const occurrence = { originalStart: details.startsAt, startsAt: details.startsAt, endsAt: details.endsAt };
    const onDone = open({ edit: { meetingId: MEETING, scope: "occurrence", occurrence } });
    expect(await screen.findByRole("heading", { name: "Edit this meeting" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Repeat")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "11:00" } });
    fireEvent.change(screen.getByLabelText("End time"), { target: { value: "11:30" } });
    await userEvent.click(screen.getByRole("button", { name: "Send update" }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    const body = api.callsTo("PATCH", SCHEDULE)[0]?.body as Record<string, unknown>;
    expect(body).toMatchObject({ scope: "occurrence", originalStart: details.startsAt });
    expect(body).not.toHaveProperty("repeat");
    expect(body).not.toHaveProperty("invitees");
  });

  it("TC-F13-35 [AC-F13-18] someone who can't change it sees 'not found'", async () => {
    fakeApi({ [`GET ${SCHEDULE}`]: () => refuse("NOT_FOUND", 404) });
    open({ edit: { meetingId: MEETING, scope: "series" } });
    expect(await screen.findByText("This meeting can't be found, or you can't change it.")).toBeInTheDocument();
  });
});
