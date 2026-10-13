// Removed while the app is open (TC-F01-61, AC-F01-23): when the open workspace is missing from a fresh
// /me, the app opens Personal and says "You are no longer a member of <name>" until dismissed. Leaving
// on purpose (switching to Personal first) shows no such message.
import { act, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "../../pages/HomePage/HomePage.tsx";
import { installFakeAuth, PAT, renderWithApp } from "../auth/fake-auth.tsx";
import { fakeApi, IDS, json, ME } from "./fake-api.ts";
import { CurrentWorkspaceProvider, useCurrentWorkspace } from "./current-workspace.tsx";
import { ME_KEY } from "./me.ts";

/** Lets a test ask /me again now (instead of waiting 30 s) and switch workspaces. */
const app: { refresh: () => Promise<unknown>; switchTo: (id: string) => void } = {
  refresh: () => Promise.resolve(),
  switchTo: () => {},
};
function Hooks() {
  const client = useQueryClient();
  const { switchTo } = useCurrentWorkspace();
  useEffect(() => {
    app.refresh = () => client.refetchQueries({ queryKey: ME_KEY, exact: true });
    app.switchTo = switchTo;
  }, [client, switchTo]);
  return null;
}

let api: ReturnType<typeof fakeApi>;
beforeEach(() => {
  installFakeAuth(PAT);
  api = fakeApi();
});
afterEach(() => vi.unstubAllGlobals());

async function openOnAria() {
  renderWithApp(
    <CurrentWorkspaceProvider>
      <Hooks />
      <HomePage onNavigate={vi.fn()} />
    </CurrentWorkspaceProvider>,
  );
  await screen.findByRole("heading", { level: 1, name: "Aria" });
}
const withoutAria = {
  ...ME,
  workspaces: ME.workspaces.filter((w) => w.id !== IDS.aria),
  currentWorkspaceId: IDS.personal,
};

describe("removed while the app is open", () => {
  it("TC-F01-61 [AC-F01-23] the next check opens Personal and says so; Dismiss hides it", async () => {
    await openOnAria();
    api.handlers["/api/v1/me"] = () => json(withoutAria);
    await act(() => app.refresh());
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Personal"));
    expect(screen.getByText("You are no longer a member of Aria.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toHaveTextContent("People");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/no longer a member/)).not.toBeInTheDocument();
  });

  it("TC-F01-61 [AC-F01-23] after switching away first (leaving here), no message shows", async () => {
    await openOnAria();
    act(() => app.switchTo(IDS.personal));
    await screen.findByRole("heading", { level: 1, name: "Personal" });
    api.handlers["/api/v1/me"] = () => json(withoutAria);
    await act(() => app.refresh());
    expect(screen.queryByText(/no longer a member/)).not.toBeInTheDocument();
  });

  it("TC-F01-53 [AC-F01-19] a company workspace shows People and Requests with the waiting count", async () => {
    await openOnAria();
    expect(screen.getByRole("button", { name: "People" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Requests and invitations 2" })).toBeInTheDocument();
  });
});
