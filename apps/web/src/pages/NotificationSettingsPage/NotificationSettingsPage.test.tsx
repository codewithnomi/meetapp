// Settings → Notifications (AC-F04-36): the five switches show the saved choices, apply at once, and fall
// back to all on while they can't be loaded (TC-F04-68).
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { fakeApi, json } from "../../features/workspaces/fake-api.ts";
import { NotificationSettingsPage } from "./NotificationSettingsPage.tsx";

const URL = "/api/v1/me/notification-settings";
const NAMES = ["Chat messages", "Mentions", "Someone waiting in the lobby", "Sound", "Show message preview"];

beforeEach(() => installFakeAuth(PAT));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Settings → Notifications (F04 T9)", () => {
  it("TC-F04-65 [AC-F04-36] shows the saved choices; a switch saves only its own key", async () => {
    let saved = { messages: true, mentions: true, lobby: true, sound: false, preview: true };
    const api = fakeApi({
      [`GET ${URL}`]: () => json(saved),
      [`PUT ${URL}`]: (body) => ((saved = { ...saved, ...(body as object) }), json(saved)),
    });
    renderWithApp(<NotificationSettingsPage onNavigate={vi.fn()} onBack={vi.fn()} />);
    const sound = screen.getByRole("switch", { name: "Sound" });
    await waitFor(() => expect(sound).not.toBeChecked());
    expect(NAMES.map((name) => screen.getByRole("switch", { name }))).toHaveLength(5);
    await userEvent.click(screen.getByRole("switch", { name: "Show message preview" }));
    await waitFor(() => expect(api.callsTo("PUT", URL)).toHaveLength(1));
    expect(api.callsTo("PUT", URL)[0]?.body).toEqual({ preview: false });
    expect(screen.getByRole("switch", { name: "Show message preview" })).not.toBeChecked();
  });

  it("TC-F04-68 [AC-F04-36] can't load: all on, tried again, then the real values apply", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let works = false;
    fakeApi({
      [`GET ${URL}`]: () =>
        works ? json({ messages: false, mentions: true, lobby: true, sound: true, preview: true }) : json({}, 503),
    });
    renderWithApp(<NotificationSettingsPage onNavigate={vi.fn()} onBack={vi.fn()} />);
    for (const name of NAMES) expect(screen.getByRole("switch", { name })).toBeChecked();
    works = true;
    await vi.advanceTimersByTimeAsync(31_000);
    await waitFor(() => expect(screen.getByRole("switch", { name: "Chat messages" })).not.toBeChecked());
  });
});
