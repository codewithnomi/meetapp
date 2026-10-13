// The Profile and account screen with a stubbed backend (TC-F01-63, 66, 68; AC-F01-10, 12, 25): name,
// photo upload with the exact refusal, Remove, the sign-in rows, changing the password through the
// desktop bridge, and the support email.
import { focusManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp, type FakeAuth } from "../../features/auth/fake-auth.tsx";
import { fakeApi, json, ME, noContent, refuse, type Handler } from "../../features/workspaces/fake-api.ts";
import { ProfilePage } from "./ProfilePage.tsx";

const RULE = "Use a JPEG, PNG or WebP image up to 5 MB.";
let api: ReturnType<typeof fakeApi>;
let auth: FakeAuth;
const withUser = (user: object) => ({ ...ME, user: { ...ME.user, ...user } });

function open(extra: Record<string, Handler> = {}) {
  api = fakeApi(extra);
  renderWithApp(<ProfilePage onNavigate={vi.fn()} onBack={vi.fn()} />);
}
const png = (size = 10) => new File([new Uint8Array(size)], "me.png", { type: "image/png" });
const picker = () => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file picker");
  return input;
};

beforeEach(() => {
  auth = installFakeAuth(PAT);
});
afterEach(() => vi.unstubAllGlobals());

describe("Profile and account", () => {
  it("TC-F01-63 [AC-F01-25] the name is saved trimmed; an empty one is refused before sending", async () => {
    open({ "PATCH /api/v1/me": noContent });
    const field = await screen.findByRole("textbox", { name: "Your name" });
    expect(field).toHaveValue("Pat Lee");
    await userEvent.clear(field);
    await userEvent.type(field, "   ");
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(field).toHaveAccessibleDescription("Use 1 to 60 characters.");
    expect(api.callsTo("PATCH", "/api/v1/me")).toHaveLength(0);
    await userEvent.clear(field);
    await userEvent.type(field, "  Pat Q  ");
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByText("Name saved.")).toBeInTheDocument();
    expect(api.callsTo("PATCH", "/api/v1/me")[0]?.body).toEqual({ name: "Pat Q" });
  });

  it("TC-F01-68 [AC-F01-25] a photo file is sent as it is; a big or wrong file shows the exact rule unsent", async () => {
    open({ "PUT /api/v1/me/avatar": () => json({ photoUrl: "/api/v1/users/u-1/avatar?v=k" }) });
    await screen.findByRole("button", { name: "Upload a photo" });
    await userEvent.upload(picker(), png(5 * 1024 * 1024 + 1));
    expect(await screen.findByRole("alert")).toHaveTextContent(RULE);
    await userEvent.upload(picker(), new File(["x"], "me.gif", { type: "image/gif" }));
    expect(api.callsTo("PUT", "/api/v1/me/avatar")).toHaveLength(0);
    const file = png();
    await userEvent.upload(picker(), file);
    await waitFor(() => expect(api.callsTo("PUT", "/api/v1/me/avatar")).toHaveLength(1));
    expect(api.callsTo("PUT", "/api/v1/me/avatar")[0]?.raw).toBe(file);
    await waitFor(() => expect(api.callsTo("GET", "/api/v1/me").length).toBeGreaterThan(1));
  });

  it("TC-F01-68 [AC-F01-25] the server's refusal (or 413) shows the same rule", async () => {
    open({ "PUT /api/v1/me/avatar": () => refuse("BAD_REQUEST", 413) });
    await screen.findByRole("button", { name: "Upload a photo" });
    await userEvent.upload(picker(), png());
    expect(await screen.findByRole("alert")).toHaveTextContent(RULE);
  });

  it("TC-F01-66 [AC-F01-25] with a photo it shows from the backend, and Remove deletes it", async () => {
    open({
      "/api/v1/me": () => json(withUser({ photoUrl: "/api/v1/users/u-1/avatar?v=k" })),
      "DELETE /api/v1/me/avatar": noContent,
    });
    await userEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() => expect(api.callsTo("DELETE", "/api/v1/me/avatar")).toHaveLength(1));
    const photo = document.querySelector("main img");
    expect(photo?.getAttribute("src")).toMatch(/^http.*\/api\/v1\/users\/u-1\/avatar\?v=k$/);
  });

  it("TC-F01-63 [AC-F01-10] email confirmed, linked ways to sign in, and the support email", async () => {
    open({ "/api/v1/me": () => json(withUser({ signInMethods: ["password", "google"] })) });
    expect(await screen.findByText("Google linked. A code by email always works.")).toBeInTheDocument();
    expect(screen.getByText(PAT.email)).toBeInTheDocument();
    expect(screen.getByText(/email privacy@meetapp\.test\. We reply within 30 days\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out everywhere" })).toBeInTheDocument();
  });

  it("TC-F01-28 [AC-F01-10] Change password goes through the desktop bridge with the current password", async () => {
    open();
    await userEvent.click(await screen.findByRole("button", { name: "Change password" }));
    const dialog = await screen.findByRole("dialog", { name: "Change password" });
    await userEvent.type(within(dialog).getByLabelText("Current password"), "old secret 1");
    await userEvent.type(within(dialog).getByLabelText("New password"), "new secret 22");
    await userEvent.click(within(dialog).getByRole("button", { name: "Change password" }));
    await waitFor(() =>
      expect(auth.changePassword).toHaveBeenCalledWith({
        newPassword: "new secret 22",
        currentPassword: "old secret 1",
      }),
    );
    expect(await screen.findByText("Password changed. Your other devices were signed out.")).toBeInTheDocument();
  });

  it("TC-F01-28 [AC-F01-10] without a password, a code is emailed first and then used", async () => {
    open({ "/api/v1/me": () => json(withUser({ signInMethods: ["google"] })) });
    await userEvent.click(await screen.findByRole("button", { name: "Set a password" }));
    await userEvent.click(await screen.findByRole("button", { name: "Send the code" }));
    expect(auth.requestCode).toHaveBeenCalledWith(PAT.email, "reset");
    await userEvent.type(await screen.findByLabelText("Code from the email"), "123456");
    await userEvent.type(screen.getByLabelText("New password"), "new secret 22");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() =>
      expect(auth.changePassword).toHaveBeenCalledWith({ newPassword: "new secret 22", code: "123456" }),
    );
  });

  it("TC-F01-68 [AC-F01-25] a name changed elsewhere shows in the field after the next check", async () => {
    open();
    const field = await screen.findByRole("textbox", { name: "Your name" });
    expect(field).toHaveValue("Pat Lee");
    api.handlers["/api/v1/me"] = () => json(withUser({ name: "Pat Renamed" }));
    // The window regains focus: /me is asked again (as on the 30-second check).
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Your name" })).toHaveValue("Pat Renamed"));
  });
});
