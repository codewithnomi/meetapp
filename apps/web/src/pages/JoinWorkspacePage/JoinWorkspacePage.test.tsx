// The Join a workspace screen with a stubbed backend (TC-F01-48, 53; AC-F01-18, 19, 20): accepting an
// invitation opens the workspace; a code finds a workspace card, Ask to join says "Request sent"; a wrong
// code is explained; someone already in it is taken there.
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { CurrentWorkspaceProvider } from "../../features/workspaces/index.ts";
import { fakeApi, IDS, json, refuse, type Handler } from "../../features/workspaces/fake-api.ts";
import { JoinWorkspacePage } from "./JoinWorkspacePage.tsx";

const INVITATION = {
  id: "00000000-0000-4000-8000-0000000000e1",
  workspace: { id: IDS.north, name: "Northwind" },
  inviterName: "Omar Sheikh",
  role: "member",
  expiresAt: new Date(Date.now() + 6 * 86_400_000 + 60_000).toISOString(),
};
const NORTH = { id: IDS.north, name: "Northwind", kind: "company", role: "member" };

let api: ReturnType<typeof fakeApi>;
const setUp = (extra: Record<string, Handler> = {}) => {
  api = fakeApi({ "/api/v1/me/invitations": () => json({ invitations: [INVITATION] }), ...extra });
};
beforeEach(() => installFakeAuth(PAT));
afterEach(() => vi.unstubAllGlobals());

function open() {
  const onBack = vi.fn();
  renderWithApp(
    <CurrentWorkspaceProvider>
      <JoinWorkspacePage onBack={onBack} />
    </CurrentWorkspaceProvider>,
  );
  return onBack;
}
const typeCode = async (code: string) => {
  await userEvent.type(screen.getByRole("textbox", { name: "Join link or code" }), code);
  await userEvent.click(screen.getByRole("button", { name: "Find workspace" }));
};

describe("Join a workspace screen", () => {
  it("TC-F01-48 [AC-F01-18] shows the invitation; Join opens that workspace", async () => {
    setUp({
      [`POST /api/v1/invitations/${INVITATION.id}/accept`]: () => json({ workspace: NORTH, switchTo: IDS.north }),
    });
    const onBack = open();
    expect(await screen.findByRole("heading", { name: `Invitations for ${PAT.email}` })).toBeInTheDocument();
    expect(await screen.findByText("Omar Sheikh invited you as member · expires in 6 days")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    await waitFor(() => expect(onBack).toHaveBeenCalled());
    await waitFor(() =>
      expect(api.callsTo("PUT", "/api/v1/me/last-workspace")[0]?.body).toEqual({ workspaceId: IDS.north }),
    );
  });

  it("TC-F01-53 [AC-F01-19] a code finds the workspace; Ask to join says Request sent", async () => {
    setUp({
      "POST /api/v1/join/lookup": () => json({ name: "Northwind", memberCount: 12, alreadyMember: false }),
      "POST /api/v1/join/request": () => json({ status: "pending" }, 201),
    });
    open();
    await typeCode("nw7kq-2pxab");
    expect(await screen.findByText("12 people · you'll join as a member")).toBeInTheDocument();
    expect(api.callsTo("POST", "/api/v1/join/lookup")[0]?.body).toEqual({ linkOrCode: "nw7kq-2pxab" });
    await userEvent.click(screen.getByRole("button", { name: "Ask to join" }));
    expect(await screen.findByText("Request sent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask to join" })).toBeDisabled();
  });

  it("TC-F01-53 [AC-F01-19] a wrong code is explained under the field; an empty one sends nothing", async () => {
    setUp({ "POST /api/v1/join/lookup": () => refuse("NOT_FOUND", 404) });
    open();
    await userEvent.click(screen.getByRole("button", { name: "Find workspace" }));
    expect(screen.getByRole("textbox", { name: "Join link or code" })).toHaveAccessibleDescription(
      "Paste a join link or type a code.",
    );
    expect(api.callsTo("POST", "/api/v1/join/lookup")).toHaveLength(0);
    await typeCode("WRONGCODE1");
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Join link or code" })).toHaveAccessibleDescription(
        "No workspace found. Check the link or code, or ask for a new one.",
      ),
    );
  });

  it("TC-F01-53 [AC-F01-20] someone already in the workspace is taken there", async () => {
    setUp({
      "POST /api/v1/join/lookup": () =>
        json({ name: "Aria", memberCount: 3, alreadyMember: true, workspaceId: IDS.aria }),
    });
    const onBack = open();
    await typeCode("AR4N7QXDKM");
    await waitFor(() => expect(onBack).toHaveBeenCalled());
    expect(api.callsTo("POST", "/api/v1/join/request")).toHaveLength(0);
  });

  it("TC-F01-53 [AC-F01-19] a second search that finds nothing removes the first workspace's card", async () => {
    let calls = 0;
    setUp({
      "POST /api/v1/join/lookup": () =>
        ++calls === 1 ? json({ name: "Northwind", memberCount: 12, alreadyMember: false }) : refuse("NOT_FOUND", 404),
    });
    open();
    await typeCode("NW7KQ2PXAB");
    expect(await screen.findByRole("button", { name: "Ask to join" })).toBeInTheDocument();
    await userEvent.clear(screen.getByRole("textbox", { name: "Join link or code" }));
    await typeCode("WRONGCODE1");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Ask to join" })).not.toBeInTheDocument());
  });
});
