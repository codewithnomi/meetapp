// The People screen with a stubbed backend (TC-F01-48, 61; AC-F01-17, 19, 21, 22, 23): what the owner
// and a member see, inviting several addresses, the join link, role changes, removal and leaving.
import type { WorkspaceAction } from "@meetapp/contracts";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { CurrentWorkspaceProvider } from "../../features/workspaces/index.ts";
import { fakeApi, IDS, json, noContent, refuse, type Handler } from "../../features/workspaces/fake-api.ts";
import { PeoplePage } from "./PeoplePage.tsx";

const W = `/api/v1/workspaces/${IDS.aria}`;
const person = (userId: string, name: string, role: string) => ({
  userId,
  name,
  email: `${name.split(" ")[0]?.toLowerCase() ?? ""}@aria.test`,
  role,
  joinedAt: "2026-10-02T09:00:00.000Z",
  photoUrl: null,
});
const MEMBERS = [
  person(PAT.id, "Pat Lee", "owner"),
  person("00000000-0000-4000-8000-0000000000a1", "Omar Sheikh", "admin"),
  person("00000000-0000-4000-8000-0000000000b1", "Sara Malik", "member"),
];
const OWNER_ACTIONS: WorkspaceAction[] = [
  "viewMembers",
  "copyJoinLink",
  "inviteMember",
  "inviteAdmin",
  "manageJoinLink",
  "promoteMember",
  "removeMember",
  "demoteAdmin",
  "removeAdmin",
  "transfer",
];
const LINK = { enabled: true, link: "http://127.0.0.1:3010/join/abc", code: "AR4N7QXDKM" };

let api: ReturnType<typeof fakeApi>;
const setUp = (yourActions = OWNER_ACTIONS, extra: Record<string, Handler> = {}) => {
  api = fakeApi({
    [`GET ${W}/members`]: () => json({ members: MEMBERS, yourActions }),
    [`GET ${W}/join-link`]: () => json(LINK),
    ...extra,
  });
};

beforeEach(() => installFakeAuth(PAT));
afterEach(() => vi.unstubAllGlobals());

async function openPeople() {
  const onNavigate = vi.fn();
  renderWithApp(
    <CurrentWorkspaceProvider>
      <PeoplePage onNavigate={onNavigate} />
    </CurrentWorkspaceProvider>,
  );
  await screen.findByRole("heading", { level: 1, name: "People in Aria" });
  await screen.findByText("sara@aria.test");
  return onNavigate;
}
const row = (name: string) => screen.getByRole("row", { name: new RegExp(name) });
const chooseAction = async (name: string, action: string) => {
  await userEvent.click(screen.getByRole("button", { name: `Actions for ${name}` }));
  await userEvent.click(screen.getByRole("menuitem", { name: action }));
};

describe("People screen", () => {
  it("TC-F01-61 [AC-F01-21] the owner sees everyone with role and join date, the role choice and the link switch", async () => {
    setUp();
    await openPeople();
    expect(screen.getByText("3 people · anyone here can invite others as members.")).toBeInTheDocument();
    expect(within(row("Omar Sheikh")).getByText("Admin")).toBeInTheDocument();
    expect(within(row("Pat Lee")).getByText("You")).toBeInTheDocument();
    expect(within(row("Sara Malik")).getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Role" })).toBeInTheDocument();
    expect(await screen.findByRole("switch", { name: "Join link and code" })).toBeChecked();
    expect(screen.getByText("AR4N7-QXDKM")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actions for Pat Lee" })).not.toBeInTheDocument();
  });

  it("TC-F01-48 [AC-F01-17] several addresses: one call each; a refused one stays in the field with the reason", async () => {
    setUp(OWNER_ACTIONS, {
      [`POST ${W}/invitations`]: (body) =>
        (body as { email: string }).email === "omar@aria.test"
          ? refuse("ALREADY_MEMBER", 409)
          : json({ invitation: {} }, 201),
    });
    await openPeople();
    const field = screen.getByRole("textbox", { name: "Email addresses" });
    await userEvent.type(field, "New@Example.com, omar@aria.test");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Role" }), "admin");
    await userEvent.click(screen.getByRole("button", { name: "Send invitations" }));
    await waitFor(() => expect(api.callsTo("POST", `${W}/invitations`)).toHaveLength(2));
    expect(api.callsTo("POST", `${W}/invitations`)[0]?.body).toEqual({ email: "new@example.com", role: "admin" });
    expect(await screen.findByText("Invitation sent to new@example.com.")).toBeInTheDocument();
    expect(field).toHaveValue("omar@aria.test");
    expect(field).toHaveAccessibleDescription("omar@aria.test is already a member.");
  });

  it("TC-F01-48 [AC-F01-17] a mistyped address sends nothing; the daily limit is explained", async () => {
    setUp(OWNER_ACTIONS, { [`POST ${W}/invitations`]: () => refuse("TOO_MANY_ATTEMPTS", 429) });
    await openPeople();
    const field = screen.getByRole("textbox", { name: "Email addresses" });
    await userEvent.type(field, "sara@");
    await userEvent.click(screen.getByRole("button", { name: "Send invitations" }));
    expect(field).toHaveAccessibleDescription("Check this address: sara@");
    expect(api.callsTo("POST", `${W}/invitations`)).toHaveLength(0);
    await userEvent.clear(field);
    await userEvent.type(field, "a@example.com b@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send invitations" }));
    await waitFor(() => expect(field).toHaveAccessibleDescription("Invite limit reached, try again tomorrow."));
    expect(api.callsTo("POST", `${W}/invitations`)).toHaveLength(1);
  });

  it("TC-F01-61 [AC-F01-21] Make admin is sent at once; Remove asks first, then removes", async () => {
    setUp(OWNER_ACTIONS, {
      [`PATCH ${W}/members/${MEMBERS[2]?.userId ?? ""}`]: noContent,
      [`DELETE ${W}/members/${MEMBERS[2]?.userId ?? ""}`]: noContent,
    });
    await openPeople();
    await chooseAction("Sara Malik", "Make admin");
    await waitFor(() => expect(api.calls.some((c) => c.method === "PATCH")).toBe(true));
    expect(api.calls.find((c) => c.method === "PATCH")?.body).toEqual({ role: "admin" });
    await chooseAction("Sara Malik", "Remove from workspace");
    const dialog = await screen.findByRole("dialog", { name: "Remove Sara Malik?" });
    expect(api.calls.some((c) => c.method === "DELETE")).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(api.calls.some((c) => c.method === "DELETE")).toBe(true));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("TC-F01-61 [AC-F01-22] handing over asks first and sends the confirmation", async () => {
    setUp(OWNER_ACTIONS, { [`POST ${W}/transfer`]: noContent });
    await openPeople();
    await chooseAction("Omar Sheikh", "Hand over ownership");
    const dialog = await screen.findByRole("dialog", { name: "Hand Aria over to Omar Sheikh?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Hand over" }));
    await waitFor(() => expect(api.callsTo("POST", `${W}/transfer`)).toHaveLength(1));
    expect(api.callsTo("POST", `${W}/transfer`)[0]?.body).toEqual({ userId: MEMBERS[1]?.userId, confirm: true });
  });

  it("TC-F01-61 [AC-F01-21, AC-F01-23] a member: no role choice, no switch; can leave, then Home opens", async () => {
    setUp(["viewMembers", "copyJoinLink", "inviteMember", "cancelOwnInvitation", "leave"], {
      [`POST ${W}/leave`]: noContent,
    });
    const onNavigate = await openPeople();
    expect(screen.queryByRole("combobox", { name: "Role" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actions for Sara Malik" })).not.toBeInTheDocument();
    await chooseAction("Pat Lee", "Leave workspace");
    const dialog = await screen.findByRole("dialog", { name: "Leave Aria?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Leave workspace" }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("home"));
    expect(api.callsTo("PUT", "/api/v1/me/last-workspace")[0]?.body).toEqual({ workspaceId: IDS.personal });
  });

  it("TC-F01-53 [AC-F01-19] the owner turns the link off; the card then shows nothing to copy", async () => {
    setUp(OWNER_ACTIONS, {
      [`PUT ${W}/join-link`]: () => json({ enabled: false, link: null, code: null }),
    });
    await openPeople();
    await userEvent.click(await screen.findByRole("switch", { name: "Join link and code" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument());
    expect(api.callsTo("PUT", `${W}/join-link`)[0]?.body).toEqual({ enabled: false });
  });
});
