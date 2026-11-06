// Settings → General (TC-F04-22, AC-F04-09): start at login, through a fake desktop bridge.
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { GeneralSettingsPage } from "./GeneralSettingsPage.tsx";

let stored = true;
function withBridge(fail = false) {
  (window as { meetapp?: unknown }).meetapp = {
    app: {
      loginItem: {
        get: () => Promise.resolve(stored),
        set: (on: boolean) => (fail ? Promise.reject(new Error("no")) : ((stored = on), Promise.resolve(stored))),
      },
    },
  };
}

beforeEach(() => installFakeAuth(PAT));
afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as { meetapp?: unknown }).meetapp;
  stored = true;
});

describe("Settings → General (F04 T5)", () => {
  it("TC-F04-22 [AC-F04-09] the switch shows the computer's state and turns start at login off and on", async () => {
    withBridge();
    renderWithApp(<GeneralSettingsPage onNavigate={vi.fn()} onBack={vi.fn()} />);
    const toggle = await screen.findByRole("switch", { name: "Start MeetApp when I log in" });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(stored).toBe(false);
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
  });

  it("TC-F04-22 [AC-F04-09] a change that fails says so and keeps the real state", async () => {
    withBridge(true);
    renderWithApp(<GeneralSettingsPage onNavigate={vi.fn()} onBack={vi.fn()} />);
    const toggle = await screen.findByRole("switch", { name: "Start MeetApp when I log in" });
    await userEvent.click(toggle);
    expect(await screen.findByText("This setting couldn't be changed. Try again.")).toBeInTheDocument();
    expect(toggle).toBeChecked();
  });
});
