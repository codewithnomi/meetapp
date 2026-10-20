// JoinMeetingPage (guests) with a stubbed backend: TC-F02-90 (AC-F02-45), loading and error states.
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { never } from "../../features/meetings/fake-visit.ts";
import { fakeApi, refuse } from "../../features/workspaces/fake-api.ts";
import { JoinMeetingPage } from "./JoinMeetingPage.tsx";

const LOOKUP = "POST /api/v1/meeting-lookups";
beforeEach(() => installFakeAuth(null));
afterEach(() => vi.unstubAllGlobals());

async function submitLink() {
  renderWithApp(<JoinMeetingPage onFound={vi.fn()} onBack={vi.fn()} />);
  await userEvent.click(screen.getByRole("radio", { name: "Link" }));
  await userEvent.type(screen.getByLabelText("Meeting link"), "https://x.test/m/aaaaaaaaaaaaaaaaaaaaaa");
  await userEvent.click(screen.getByRole("button", { name: /^Join$/ }));
}

describe("TC-F02-90 Join a meeting (guest) loading and error states", () => {
  it("TC-F02-90 [AC-F02-45] shows a waiting state while the meeting is looked up", async () => {
    fakeApi({ [LOOKUP]: never });
    await submitLink();
    expect(await screen.findByText("Finding the meeting")).toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] a miss and an expired meeting each have their own words", async () => {
    const api = fakeApi({ [LOOKUP]: () => refuse("MEETING_NOT_FOUND", 404) });
    await submitLink();
    expect(await screen.findByText(/We couldn't find that meeting/)).toBeInTheDocument();
    api.handlers[LOOKUP] = () => refuse("MEETING_EXPIRED", 410);
    await userEvent.click(screen.getByRole("button", { name: /^Join$/ }));
    expect(await screen.findByText(/This meeting has expired/)).toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] when MeetApp can't be reached it says so, with Retry", async () => {
    fakeApi({
      [LOOKUP]: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await submitLink();
    expect(await screen.findByText("Can't reach MeetApp. Check your connection.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
