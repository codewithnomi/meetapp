// The workspace switcher and "Create a company workspace" in the app (TC-F01-41, AC-F01-15, 16, 29):
// a stubbed backend answers /api/v1/me; calls are matched by path.
import type { MeResponse } from "@meetapp/contracts";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "../../pages/HomePage/HomePage.tsx";
import { installFakeAuth, PAT, renderWithApp } from "../auth/fake-auth.tsx";
import { CurrentWorkspaceProvider } from "./current-workspace.tsx";

const ID = {
  personal: "00000000-0000-4000-8000-000000000001",
  aria: "00000000-0000-4000-8000-000000000002",
  north: "00000000-0000-4000-8000-000000000003",
  fresh: "00000000-0000-4000-8000-000000000004",
};
const base = { createdAt: "2026-01-01T00:00:00.000Z", pendingRequests: 0 };
const ME = {
  user: PAT,
  currentWorkspaceId: ID.personal,
  workspaces: [
    { ...base, id: ID.personal, name: "x", kind: "personal", role: "owner" },
    { ...base, id: ID.aria, name: "Aria", kind: "company", role: "owner" },
    { ...base, id: ID.north, name: "Northwind", kind: "company", role: "member" },
  ],
} as unknown as MeResponse;

type Handler = (init: RequestInit) => Response | Promise<Response>;
interface Call {
  path: string;
  init: RequestInit;
}
let calls: Call[];
let handlers: Record<string, Handler>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const callsTo = (path: string) => calls.filter((call) => call.path === path);

beforeEach(() => {
  calls = [];
  handlers = {
    "/api/v1/me": () => json(ME),
    "/api/v1/me/last-workspace": () => new Response(null, { status: 204 }),
  };
  installFakeAuth(PAT);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = new URL(String(input)).pathname;
      calls.push({ path, init });
      return (handlers[path] ?? (() => json([])))(init);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

async function openApp(onJoin = vi.fn()) {
  renderWithApp(
    <CurrentWorkspaceProvider>
      <HomePage onOpenSettings={vi.fn()} onJoin={onJoin} />
    </CurrentWorkspaceProvider>,
  );
  await screen.findByRole("button", { name: "Switch workspace: Personal" });
  return onJoin;
}
const openMenu = (name = "Personal") =>
  userEvent.click(screen.getByRole("button", { name: `Switch workspace: ${name}` }));
const heading = () => screen.getByRole("heading", { level: 1 });
const lastWorkspaceBody = () => JSON.parse(String(callsTo("/api/v1/me/last-workspace")[0]?.init.body)) as object;
const idempotencyKey = (call: Call | undefined) => (call?.init.headers as Record<string, string>)["idempotency-key"];

async function openCreateDialog() {
  await openApp();
  await openMenu();
  await userEvent.click(screen.getByRole("menuitem", { name: "Create a workspace" }));
  return screen.findByRole("dialog", { name: "Create a company workspace" });
}
const nameBox = () => screen.getByRole("textbox", { name: "Workspace name" });
const submit = () => userEvent.click(screen.getByRole("button", { name: "Create workspace" }));

describe("workspace switcher", () => {
  it("TC-F01-41 [AC-F01-16] lists Personal first and all three workspaces; the open one is Personal", async () => {
    await openApp();
    expect(heading()).toHaveTextContent("Personal");
    await openMenu();
    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual(["PPersonalOnly you", "AAriaOwner", "NNorthwindMember"]);
    expect(screen.getByRole("menuitem", { name: "Create a workspace" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Join with a link or code" })).toBeInTheDocument();
  });

  it("TC-F01-41 [AC-F01-16] switching changes the heading at once and tells the backend", async () => {
    await openApp();
    await openMenu();
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Northwind/ }));
    expect(heading()).toHaveTextContent("Northwind");
    expect(screen.getByRole("button", { name: "Switch workspace: Northwind" })).toBeInTheDocument();
    await waitFor(() => expect(callsTo("/api/v1/me/last-workspace")).toHaveLength(1));
    expect(callsTo("/api/v1/me/last-workspace")[0]?.init.method).toBe("PUT");
    expect(lastWorkspaceBody()).toEqual({ workspaceId: ID.north });
  });

  it("TC-F01-41 [AC-F01-16] opens on the workspace the backend says was used last", async () => {
    handlers["/api/v1/me"] = () => json({ ...ME, currentWorkspaceId: ID.aria });
    renderWithApp(
      <CurrentWorkspaceProvider>
        <HomePage onOpenSettings={vi.fn()} onJoin={vi.fn()} />
      </CurrentWorkspaceProvider>,
    );
    expect(await screen.findByRole("button", { name: "Switch workspace: Aria" })).toBeInTheDocument();
    expect(heading()).toHaveTextContent("Aria");
  });

  it("TC-F01-41 [AC-F01-16] a failed save does not change what is on screen", async () => {
    handlers["/api/v1/me/last-workspace"] = () => json({ error: { code: "X" } }, 500);
    await openApp();
    await openMenu();
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Aria/ }));
    await waitFor(() => expect(callsTo("/api/v1/me/last-workspace")).toHaveLength(1));
    expect(heading()).toHaveTextContent("Aria");
  });

  it("TC-F01-41 [AC-F01-16] 'Join with a link or code' opens the join screen", async () => {
    const onJoin = await openApp();
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Join with a link or code" }));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });
});

describe("create a company workspace", () => {
  it("TC-F01-41 [AC-F01-15] a 1-character name shows the rule and sends nothing", async () => {
    await openCreateDialog();
    await userEvent.type(nameBox(), "A");
    await submit();
    expect(await screen.findByText("Use 2 to 60 characters.")).toBeInTheDocument();
    expect(callsTo("/api/v1/workspaces")).toHaveLength(0);
  });

  it("TC-F01-41 [AC-F01-15, AC-F01-29] a valid name is sent with an idempotency key, then the app opens it", async () => {
    const fresh = { ...base, id: ID.fresh, name: "Fresh Co", kind: "company", role: "owner" };
    handlers["/api/v1/workspaces"] = () => {
      // Like the real backend: the next /me lists the new workspace too.
      handlers["/api/v1/me"] = () => json({ ...ME, workspaces: [...ME.workspaces, fresh] });
      return json({ workspace: fresh, switchTo: ID.fresh }, 201);
    };
    await openCreateDialog();
    await userEvent.type(nameBox(), "Fresh Co");
    await submit();
    await waitFor(() => expect(heading()).toHaveTextContent("Fresh Co"));
    const post = callsTo("/api/v1/workspaces")[0];
    expect(post?.init.method).toBe("POST");
    expect(JSON.parse(String(post?.init.body))).toEqual({ name: "Fresh Co" });
    expect(idempotencyKey(post)).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(lastWorkspaceBody()).toEqual({ workspaceId: ID.fresh }));
  });

  it("TC-F01-41 [AC-F01-29] pressing Create again after a network failure re-sends the same key", async () => {
    handlers["/api/v1/workspaces"] = () => {
      throw new TypeError("Failed to fetch");
    };
    await openCreateDialog();
    await userEvent.type(nameBox(), "Fresh Co");
    await submit();
    await waitFor(() => expect(callsTo("/api/v1/workspaces")).toHaveLength(1));
    await submit();
    await waitFor(() => expect(callsTo("/api/v1/workspaces")).toHaveLength(2));
    const [first, second] = callsTo("/api/v1/workspaces");
    expect(idempotencyKey(first)).toBeTruthy();
    expect(idempotencyKey(second)).toBe(idempotencyKey(first));
  });

  it("TC-F01-41 [AC-F01-15] the 20-workspace limit is explained", async () => {
    handlers["/api/v1/workspaces"] = () => json({ error: { code: "WORKSPACE_LIMIT" } }, 409);
    await openCreateDialog();
    await userEvent.type(nameBox(), "One too many");
    await submit();
    expect(await screen.findByText("You can own at most 20 workspaces.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("TC-F01-41 [AC-F01-29] opening the dialog again uses a new key", async () => {
    handlers["/api/v1/workspaces"] = () => json({ error: { code: "WORKSPACE_LIMIT" } }, 409);
    await openCreateDialog();
    await userEvent.type(nameBox(), "Try one");
    await submit();
    await screen.findByText("You can own at most 20 workspaces.");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Create a workspace" }));
    await userEvent.type(await screen.findByRole("textbox", { name: "Workspace name" }), "Try two");
    await submit();
    await waitFor(() => expect(callsTo("/api/v1/workspaces")).toHaveLength(2));
    const [first, second] = callsTo("/api/v1/workspaces");
    expect(idempotencyKey(second)).not.toBe(idempotencyKey(first));
  });
});
