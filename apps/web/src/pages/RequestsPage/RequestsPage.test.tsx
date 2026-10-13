// The Requests and invitations screen with a stubbed backend (TC-F01-53, AC-F01-17, 19): requests with
// the "removed earlier" badge, approving, and cancelling or re-sending an invitation; a member sees only
// invitations.
import type { MeResponse } from "@meetapp/contracts";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { CurrentWorkspaceProvider } from "../../features/workspaces/index.ts";
import { fakeApi, IDS, json, ME, noContent, type Handler } from "../../features/workspaces/fake-api.ts";
import { RequestsPage } from "./RequestsPage.tsx";

const W = `/api/v1/workspaces/${IDS.aria}`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const REQUESTS = [
  {
    id: "00000000-0000-4000-8000-0000000000c1",
    person: { id: "p1", name: "Zara Iqbal", email: "zara@x.test" },
    via: "code",
    status: "pending",
    removedEarlier: false,
    createdAt: hoursAgo(2),
  },
  {
    id: "00000000-0000-4000-8000-0000000000c2",
    person: { id: "p2", name: "Kamran Butt", email: "kamran@x.test" },
    via: "link",
    status: "pending",
    removedEarlier: true,
    createdAt: hoursAgo(30),
  },
  {
    id: "00000000-0000-4000-8000-0000000000c3",
    person: { id: "p3", name: "Old One", email: "old@x.test" },
    via: "link",
    status: "expired",
    removedEarlier: false,
    createdAt: hoursAgo(400),
  },
];
const INVITATION = {
  id: "00000000-0000-4000-8000-0000000000d1",
  email: "daniel@x.test",
  role: "admin",
  invitedBy: { id: PAT.id, name: "Pat Lee" },
  createdAt: hoursAgo(48),
  expiresAt: new Date(Date.now() + 5 * 86_400_000 + 60_000).toISOString(),
};

let api: ReturnType<typeof fakeApi>;
const setUp = (extra: Record<string, Handler> = {}) => {
  api = fakeApi({
    [`GET ${W}/requests`]: () => json({ requests: REQUESTS }),
    [`GET ${W}/invitations`]: () => json({ invitations: [INVITATION] }),
    ...extra,
  });
};
beforeEach(() => installFakeAuth(PAT));
afterEach(() => vi.unstubAllGlobals());

function open() {
  renderWithApp(
    <CurrentWorkspaceProvider>
      <RequestsPage onNavigate={vi.fn()} />
    </CurrentWorkspaceProvider>,
  );
}

describe("Requests and invitations screen", () => {
  it("TC-F01-53 [AC-F01-19] lists waiting requests (not expired ones) with how they asked and the badge", async () => {
    setUp();
    open();
    expect(await screen.findByRole("heading", { name: "Asking to join (2)" })).toBeInTheDocument();
    expect(screen.getByText(/zara@x\.test · asked 2 hours ago with the join code/)).toBeInTheDocument();
    expect(screen.getByText(/kamran@x\.test · asked .* with the join link/)).toBeInTheDocument();
    expect(screen.getByText("Removed earlier")).toBeInTheDocument();
    expect(screen.queryByText("Old One")).not.toBeInTheDocument();
    expect(await screen.findByText("Invited as admin by Pat Lee · expires in 5 days")).toBeInTheDocument();
  });

  it("TC-F01-53 [AC-F01-19] Approve sends the decision and refreshes the list and the menu count", async () => {
    setUp({ [`POST ${W}/requests/${REQUESTS[0]?.id ?? ""}/approve`]: noContent });
    open();
    const zara = (await screen.findByText("Zara Iqbal")).closest("li");
    if (!zara) throw new Error("row missing");
    await userEvent.click(within(zara).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(api.callsTo("POST", `${W}/requests/${REQUESTS[0]?.id ?? ""}/approve`)).toHaveLength(1));
    await waitFor(() => expect(api.callsTo("GET", `${W}/requests`).length).toBeGreaterThan(1));
  });

  it("TC-F01-53 [AC-F01-17] Send again confirms; Cancel removes the invitation", async () => {
    setUp({
      [`POST ${W}/invitations/${INVITATION.id}/resend`]: () => json({ invitation: INVITATION }, 201),
      [`DELETE ${W}/invitations/${INVITATION.id}`]: noContent,
    });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Send again" }));
    expect(await screen.findByText("A new invitation was sent to daniel@x.test.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel invitation" }));
    await waitFor(() => expect(api.callsTo("DELETE", `${W}/invitations/${INVITATION.id}`)).toHaveLength(1));
  });

  it("TC-F01-53 [AC-F01-17] a member sees only invitations; requests are not even asked for", async () => {
    const asMember = {
      ...ME,
      workspaces: ME.workspaces.map((w) => ({ ...w, role: w.kind === "company" ? "member" : w.role })),
    };
    setUp({ "/api/v1/me": () => json(asMember as MeResponse) });
    open();
    expect(await screen.findByRole("heading", { name: "Invitations sent (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Asking to join/ })).not.toBeInTheDocument();
    expect(api.callsTo("GET", `${W}/requests`)).toHaveLength(0);
  });
});
