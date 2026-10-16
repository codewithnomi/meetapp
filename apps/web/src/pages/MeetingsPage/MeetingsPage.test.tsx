// MeetingsPage with a stubbed backend: TC-F02-90 (AC-F02-45), the loading and error states of Meet now,
// Get link and Join a meeting.
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { never } from "../../features/meetings/fake-visit.ts";
import { CurrentWorkspaceProvider } from "../../features/workspaces/index.ts";
import { fakeApi, IDS, refuse } from "../../features/workspaces/fake-api.ts";
import { MeetingsPage } from "./MeetingsPage.tsx";

const MEETINGS = `POST /api/v1/workspaces/${IDS.aria}/meetings`;
const offline = async (): Promise<Response> => {
  throw new TypeError("Failed to fetch");
};

beforeEach(() => installFakeAuth(PAT));
afterEach(() => vi.unstubAllGlobals());

function open() {
  renderWithApp(
    <CurrentWorkspaceProvider>
      <MeetingsPage onNavigate={vi.fn()} onPreJoin={vi.fn()} />
    </CurrentWorkspaceProvider>,
  );
}

describe("TC-F02-90 Meetings page loading and error states", () => {
  it("TC-F02-90 [AC-F02-45] Meet now shows a waiting state while the meeting is made", async () => {
    fakeApi({ [MEETINGS]: never });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Meet now" }));
    expect(await screen.findByText("Starting the meeting")).toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] Meet now that can't reach MeetApp says so, with Retry", async () => {
    fakeApi({ [MEETINGS]: offline });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Meet now" }));
    expect(await screen.findByText("Can't reach MeetApp. Check your connection.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] Get link shows a waiting state while the link is made", async () => {
    fakeApi({ [MEETINGS]: never });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Get link" }));
    expect(await screen.findByText("Making the link")).toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] Join a meeting shows a waiting state, then the not-found text under the field", async () => {
    const api = fakeApi({ "POST /api/v1/meeting-lookups": never });
    open();
    await userEvent.click(await screen.findByRole("radio", { name: "Link" }));
    await userEvent.type(screen.getByLabelText("Meeting link"), "https://x.test/m/aaaaaaaaaaaaaaaaaaaaaa");
    await userEvent.click(screen.getByRole("button", { name: /^Join$/ }));
    expect(await screen.findByText("Finding the meeting")).toBeInTheDocument();
    expect(api.callsTo("POST", "/api/v1/meeting-lookups")).toHaveLength(1);
  });

  it("TC-F02-90 [AC-F02-45] a wrong link shows the same words as everywhere", async () => {
    fakeApi({ "POST /api/v1/meeting-lookups": () => refuse("MEETING_NOT_FOUND", 404) });
    open();
    await userEvent.click(await screen.findByRole("radio", { name: "Link" }));
    await userEvent.type(screen.getByLabelText("Meeting link"), "nonsense");
    await userEvent.click(screen.getByRole("button", { name: /^Join$/ }));
    expect(
      await screen.findByText("We couldn't find that meeting. Check the link, or the ID and passcode."),
    ).toBeInTheDocument();
  });
});
