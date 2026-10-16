// "Meeting options" for the organizer and co-organizers (AC-F02-02, 34, 36, 37).
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../auth/fake-auth.tsx";
import { fakeApi, json, refuse } from "../workspaces/fake-api.ts";
import { MeetingOptionsDialog, type MeetingOptionsDialogProps } from "./MeetingOptionsDialog.tsx";

const WS = "00000000-0000-4000-8000-000000000002";
const ID = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
const meeting = (organizerId: string, coOrganizerIds: string[] = []) => ({
  id: "m1",
  workspaceId: WS,
  kind: "link",
  title: "Budget review",
  link: "x",
  meetingNumber: "1",
  passcode: "2",
  organizer: { id: organizerId, name: "Pat Lee" },
  expiresAt: "2026-10-30T00:00:00Z",
  options: {
    lobbyBypass: "workspace",
    whoCanPresent: "organizers",
    allowAttendeeMic: true,
    allowAttendeeCamera: true,
    coOrganizerIds,
  },
});
const members = {
  members: [
    { userId: ID(1), name: "Ann Bell", email: "a@x", role: "member", joinedAt: "2026-01-01T00:00:00Z", photoUrl: null },
    { userId: ID(2), name: "Bo Chan", email: "b@x", role: "member", joinedAt: "2026-01-01T00:00:00Z", photoUrl: null },
    { userId: "u-1", name: "Pat Lee", email: "p@x", role: "owner", joinedAt: "2026-01-01T00:00:00Z", photoUrl: null },
  ],
  yourActions: [],
};
const MEETING = "GET /api/v1/meetings/m1";
const SAVE = "PATCH /api/v1/meetings/m1/options";

beforeEach(() => installFakeAuth(PAT));
afterEach(() => vi.unstubAllGlobals());

function open(props: Partial<MeetingOptionsDialogProps> = {}) {
  const onOpenChange = vi.fn();
  renderWithApp(<MeetingOptionsDialog meetingId="m1" open onOpenChange={onOpenChange} {...props} />);
  return onOpenChange;
}

describe("meeting options dialog", () => {
  it("TC-F02-04 [AC-F02-02] shows nothing while closed or before the meeting is loaded", async () => {
    const api = fakeApi({ [MEETING]: () => json(meeting("u-1")) });
    open({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.callsTo("GET", "/api/v1/meetings/m1")).toHaveLength(0);
  });

  it("TC-F02-04 [AC-F02-02] the organizer changes the choices, adds and removes a co-organizer, and saves them in one change", async () => {
    const api = fakeApi({
      [MEETING]: () => json(meeting("u-1", [ID(1)])),
      [`GET /api/v1/workspaces/${WS}/members`]: () => json(members),
      [SAVE]: () => json(meeting("u-1")),
    });
    const onOpenChange = open();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("Ann Bell")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Who can skip the lobby?"), "everyone");
    await userEvent.selectOptions(screen.getByLabelText("Who can present?"), "workspace");
    await userEvent.click(screen.getByRole("switch", { name: /Allow mic for attendees/ }));
    await userEvent.click(screen.getByRole("switch", { name: /Allow camera for attendees/ }));
    await userEvent.click(screen.getByRole("button", { name: "Remove Ann Bell as co-organizer" }));
    await userEvent.type(screen.getByLabelText("Add a person from this workspace"), "bo");
    await userEvent.click(await screen.findByRole("button", { name: "Add Bo Chan as co-organizer" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.callsTo("PATCH", "/api/v1/meetings/m1/options")).toHaveLength(1));
    expect(api.callsTo("PATCH", "/api/v1/meetings/m1/options")[0]?.body).toEqual({
      lobbyBypass: "everyone",
      whoCanPresent: "workspace",
      allowAttendeeMic: false,
      allowAttendeeCamera: false,
      coOrganizerIds: [ID(2)],
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("TC-F02-67 [AC-F02-36] a co-organizer cannot change or even send the co-organizer list", async () => {
    const api = fakeApi({
      [MEETING]: () => json(meeting(ID(9), [ID(1)])),
      [`GET /api/v1/workspaces/${WS}/members`]: () => json(members),
      [SAVE]: () => json(meeting(ID(9))),
    });
    open();
    expect(await screen.findByText("Only the organizer can change this.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Add a person from this workspace")).toBeNull();
    expect(screen.queryByRole("button", { name: /as co-organizer/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.callsTo("PATCH", "/api/v1/meetings/m1/options")).toHaveLength(1));
    expect(api.callsTo("PATCH", "/api/v1/meetings/m1/options")[0]?.body).not.toHaveProperty("coOrganizerIds");
  });

  it("TC-F02-04 [AC-F02-02] a co-organizer who left the workspace is named 'Someone'; suggestions skip the organizer and chosen people", async () => {
    fakeApi({
      [MEETING]: () => json(meeting("u-1", [ID(7), ID(1)])),
      [`GET /api/v1/workspaces/${WS}/members`]: () => json(members),
    });
    open();
    expect(await screen.findByText("Someone")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Add a person from this workspace"), "a");
    expect(screen.queryByRole("button", { name: "Add Pat Lee as co-organizer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add Ann Bell as co-organizer" })).toBeNull();
  });

  it("TC-F02-04 [AC-F02-02] at most 10 co-organizers are sent", async () => {
    const ten = Array.from({ length: 10 }, (_, i) => ID(20 + i));
    const api = fakeApi({
      [MEETING]: () => json(meeting("u-1", ten)),
      [`GET /api/v1/workspaces/${WS}/members`]: () => json(members),
      [SAVE]: () => json(meeting("u-1")),
    });
    open();
    await userEvent.type(await screen.findByLabelText("Add a person from this workspace"), "bo");
    await userEvent.click(await screen.findByRole("button", { name: "Add Bo Chan as co-organizer" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.callsTo("PATCH", "/api/v1/meetings/m1/options")).toHaveLength(1));
    const sent = api.callsTo("PATCH", "/api/v1/meetings/m1/options")[0]?.body as { coOrganizerIds: string[] };
    expect(sent.coOrganizerIds).toHaveLength(10);
    expect(sent.coOrganizerIds).not.toContain(ID(2));
  });

  it("TC-F02-04 [AC-F02-02] a refused save says why and keeps the dialog open", async () => {
    fakeApi({
      [MEETING]: () => json(meeting("u-1")),
      [`GET /api/v1/workspaces/${WS}/members`]: () => json(members),
      [SAVE]: () => refuse("MEETING_ENDED", 409),
    });
    const onOpenChange = open();
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("TC-F02-65 [AC-F02-37] inside a call the lock switch applies at once", async () => {
    fakeApi({
      [MEETING]: () => json(meeting("u-1")),
      [`GET /api/v1/workspaces/${WS}/members`]: () => json(members),
    });
    const onChange = vi.fn();
    open({ lock: { checked: false, onChange } });
    await userEvent.click(await screen.findByRole("switch", { name: /Lock the meeting/ }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
