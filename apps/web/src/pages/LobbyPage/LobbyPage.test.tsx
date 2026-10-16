// LobbyPage with a stubbed backend: TC-F02-90 (AC-F02-45), the waiting state and the error when the
// status check fails.
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { never, stubNoDevices, VISIT } from "../../features/meetings/fake-visit.ts";
import { useVisit } from "../../features/meetings/index.ts";
import { fakeApi } from "../../features/workspaces/fake-api.ts";
import { LobbyPage } from "./LobbyPage.tsx";

const STATUS = `GET /api/v1/attendances/${VISIT.attendanceId}`;
beforeEach(() => {
  installFakeAuth(null);
  stubNoDevices();
  useVisit.getState().start(VISIT);
});
afterEach(() => {
  useVisit.getState().end();
  vi.unstubAllGlobals();
});

const open = () =>
  renderWithApp(<LobbyPage name="Pat Lee" onAdmitted={vi.fn()} onOutcome={vi.fn()} onLeft={vi.fn()} />);

describe("TC-F02-90 lobby loading and error states", () => {
  it("TC-F02-90 [AC-F02-45] shows the title and the waiting text while the status is asked", async () => {
    fakeApi({ [STATUS]: never });
    open();
    expect(screen.getByRole("heading", { level: 1, name: "Budget review" })).toBeInTheDocument();
    expect(screen.getByText("Someone in the meeting will let you in soon.")).toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] when MeetApp can't be reached it says so, with Retry", async () => {
    fakeApi({
      [STATUS]: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    open();
    expect(await screen.findByText("Can't reach MeetApp. Check your connection.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
