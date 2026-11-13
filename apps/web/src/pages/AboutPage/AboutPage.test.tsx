// Settings → About (TC-F04-84, AC-F04-50): the version from the desktop app and "Updates are turned off".
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { AboutPage } from "./AboutPage.tsx";

beforeEach(() => {
  installFakeAuth(PAT);
  (window as { meetapp?: unknown }).meetapp = {
    app: { about: () => Promise.resolve({ version: "1.2.3", updates: false }), loginItem: { get: vi.fn() } },
  };
});
afterEach(() => {
  delete (window as { meetapp?: unknown }).meetapp;
});

describe("Settings → About (F04 T17)", () => {
  it("TC-F04-84 [AC-F04-50] shows the version and that updates are off", async () => {
    renderWithApp(<AboutPage onNavigate={vi.fn()} onBack={vi.fn()} />);
    expect(await screen.findByText("Version 1.2.3")).toBeInTheDocument();
    expect(screen.getByText("Updates are turned off")).toBeInTheDocument();
  });
});
