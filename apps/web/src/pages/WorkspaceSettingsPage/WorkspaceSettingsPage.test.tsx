// WorkspaceSettingsPage with a stubbed backend: TC-F02-90 (AC-F02-45) loading and error states, and the
// "a plain member does not see the switch" part of TC-F02-83 (AC-F02-40).
import type { MeResponse } from "@meetapp/contracts";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { never } from "../../features/meetings/fake-visit.ts";
import { CurrentWorkspaceProvider } from "../../features/workspaces/index.ts";
import { fakeApi, IDS, json, ME } from "../../features/workspaces/fake-api.ts";
import { WorkspaceSettingsPage } from "./WorkspaceSettingsPage.tsx";

const SETTINGS = `PATCH /api/v1/workspaces/${IDS.aria}/settings`;
const withAria = (extra: object) =>
  ({
    ...ME,
    workspaces: ME.workspaces.map((w) => (w.id === IDS.aria ? { ...w, allowGuests: true, ...extra } : w)),
  }) as MeResponse;

beforeEach(() => installFakeAuth(PAT));
afterEach(() => vi.unstubAllGlobals());

const open = () =>
  renderWithApp(
    <CurrentWorkspaceProvider>
      <WorkspaceSettingsPage onNavigate={vi.fn()} />
    </CurrentWorkspaceProvider>,
  );

describe("TC-F02-90 workspace settings states", () => {
  it("TC-F02-90 [AC-F02-45] shows nothing of the settings until the workspace is known", () => {
    fakeApi({ "/api/v1/me": never });
    open();
    expect(screen.queryByRole("switch", { name: "Allow guests" })).not.toBeInTheDocument();
  });

  it("TC-F02-90 [AC-F02-45] the switch waits while the change is saved", async () => {
    fakeApi({ "/api/v1/me": () => json(withAria({})), [SETTINGS]: never });
    open();
    const allow = await screen.findByRole("switch", { name: "Allow guests" });
    await userEvent.click(allow);
    expect(allow).toBeDisabled();
    expect(allow).not.toBeChecked();
  });

  it("TC-F02-90 [AC-F02-45] when MeetApp can't be reached it says so, with Retry", async () => {
    fakeApi({
      "/api/v1/me": () => json(withAria({})),
      [SETTINGS]: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    open();
    await userEvent.click(await screen.findByRole("switch", { name: "Allow guests" }));
    expect(await screen.findByText("Can't reach MeetApp. Check your connection.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("TC-F02-83 Allow guests switch is for owners and admins", () => {
  it("TC-F02-83 [AC-F02-40] a plain member does not see the switch", async () => {
    fakeApi({ "/api/v1/me": () => json(withAria({ role: "member" })) });
    open();
    await vi.waitFor(() => expect(screen.queryByRole("switch", { name: "Allow guests" })).not.toBeInTheDocument());
    expect(screen.queryByRole("heading", { level: 1, name: "Workspace settings" })).not.toBeInTheDocument();
  });

  it("TC-F02-83 [AC-F02-40] an admin sees it", async () => {
    fakeApi({ "/api/v1/me": () => json(withAria({ role: "admin" })) });
    open();
    expect(await screen.findByRole("switch", { name: "Allow guests" })).toBeChecked();
  });
});
