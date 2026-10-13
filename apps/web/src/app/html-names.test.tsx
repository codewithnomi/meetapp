// TC-F01-86 (AC-F01-35), security: names that look like HTML are shown as plain text on every screen
// that shows people or workspaces (switcher, People, Requests and invitations, Join, Profile); no
// element is made from them and nothing runs. Emails and the invitation web page are checked in the
// API's tests (TC-F01-70, invitation-page.test.ts).
import type { MeResponse } from "@meetapp/contracts";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../features/auth/fake-auth.tsx";
import { CurrentWorkspaceProvider } from "../features/workspaces/index.ts";
import { fakeApi, IDS, json, ME } from "../features/workspaces/fake-api.ts";
import { JoinWorkspacePage } from "../pages/JoinWorkspacePage/index.ts";
import { PeoplePage } from "../pages/PeoplePage/index.ts";
import { ProfilePage } from "../pages/ProfilePage/index.ts";
import { RequestsPage } from "../pages/RequestsPage/index.ts";

const PERSON = "<img src=x onerror=window.__pwned=1>";
const SPACE = "<script>window.__pwned=2</script>";
const W = `/api/v1/workspaces/${IDS.aria}`;
const later = new Date(Date.now() + 86_400_000).toISOString();
const ME_EVIL = {
  ...ME,
  user: { ...ME.user, name: PERSON },
  workspaces: ME.workspaces.map((w) => (w.id === IDS.aria ? { ...w, name: SPACE } : w)),
} as MeResponse;

beforeEach(() => {
  installFakeAuth({ ...PAT, name: PERSON });
  fakeApi({
    "/api/v1/me": () => json(ME_EVIL),
    [`GET ${W}/members`]: () =>
      json({
        members: [{ userId: PAT.id, name: PERSON, email: PAT.email, role: "owner", joinedAt: later, photoUrl: null }],
        yourActions: ["viewMembers"],
      }),
    [`GET ${W}/join-link`]: () => json({ enabled: false, link: null, code: null }),
    [`GET ${W}/requests`]: () =>
      json({
        requests: [
          {
            id: IDS.north,
            person: { id: "p", name: PERSON, email: "p@x.test" },
            via: "code",
            status: "pending",
            removedEarlier: false,
            createdAt: later,
          },
        ],
      }),
    [`GET ${W}/invitations`]: () =>
      json({
        invitations: [
          {
            id: IDS.north,
            email: "i@x.test",
            role: "member",
            invitedBy: { id: "p", name: PERSON },
            createdAt: later,
            expiresAt: later,
          },
        ],
      }),
    "/api/v1/me/invitations": () =>
      json({
        invitations: [
          {
            id: IDS.north,
            workspace: { id: IDS.north, name: SPACE },
            inviterName: PERSON,
            role: "member",
            expiresAt: later,
          },
        ],
      }),
  });
});
afterEach(() => vi.unstubAllGlobals());

/** Nothing was made from the names: no image or script element, and no script ran. */
function expectInert() {
  expect(document.querySelectorAll("img, script")).toHaveLength(0);
  expect((window as { __pwned?: number }).__pwned).toBeUndefined();
}

const inShell = (page: React.ReactNode) => renderWithApp(<CurrentWorkspaceProvider>{page}</CurrentWorkspaceProvider>);

describe("TC-F01-86 HTML in names", () => {
  it("TC-F01-86 [AC-F01-35] switcher and People show the names as text", async () => {
    inShell(<PeoplePage onNavigate={vi.fn()} />);
    expect(await screen.findByRole("heading", { level: 1, name: `People in ${SPACE}` })).toBeInTheDocument();
    expect(await screen.findByText(PERSON)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: `Switch workspace: ${SPACE}` }));
    expect(
      screen.getByRole("menuitemradio", { name: new RegExp(SPACE.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")) }),
    ).toBeInTheDocument();
    expectInert();
  });

  it("TC-F01-86 [AC-F01-35] requests and sent invitations show the names as text", async () => {
    inShell(<RequestsPage onNavigate={vi.fn()} />);
    const asking = await screen.findByRole("heading", { name: "Asking to join (1)" });
    expect(within(asking.parentElement ?? document.body).getByText(PERSON)).toBeInTheDocument();
    expect(
      await screen.findByText(new RegExp(`by ${PERSON.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`)),
    ).toBeInTheDocument();
    expectInert();
  });

  it("TC-F01-86 [AC-F01-35] the Join screen and the Profile show the names as text", async () => {
    const join = inShell(<JoinWorkspacePage onBack={vi.fn()} />);
    expect(await screen.findByText(SPACE)).toBeInTheDocument();
    expectInert();
    join.unmount();
    inShell(<ProfilePage onNavigate={vi.fn()} onBack={vi.fn()} />);
    expect(await screen.findByRole("textbox", { name: "Your name" })).toHaveValue(PERSON);
    expect(screen.getByRole("img", { name: PERSON })).toBeInTheDocument();
    expect(document.querySelectorAll("img, script")).toHaveLength(0);
  });
});
