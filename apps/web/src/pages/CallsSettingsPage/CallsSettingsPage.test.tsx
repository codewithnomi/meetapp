// Settings → Calls (TC-F15-52 side, AC-F15-32): the ringtone and volume are saved on the account.
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeAuth, PAT, renderWithApp } from "../../features/auth/fake-auth.tsx";
import { fakeApi, json, noContent } from "../../features/workspaces/fake-api.ts";
import { CallsSettingsPage } from "./CallsSettingsPage.tsx";

const SETTINGS = "/api/v1/me/settings";

beforeEach(() => installFakeAuth(PAT));
afterEach(() => vi.unstubAllGlobals());

const open = () => renderWithApp(<CallsSettingsPage onNavigate={vi.fn()} onBack={vi.fn()} />);

describe("Settings → Calls", () => {
  it("TC-F15-52 [AC-F15-32] shows the 5 tones with the saved one chosen", async () => {
    fakeApi({ [SETTINGS]: () => json({ ringtone: 3, ringVolume: 60 }) });
    open();
    for (const name of ["Bright", "Chime", "Pulse", "Classic", "Gentle"]) {
      expect(await screen.findByRole("button", { name: `Play ${name}` })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: /Pulse/ })).toBeChecked();
  });

  it("TC-F15-52 [AC-F15-32] choosing tone 4 saves {ringtone: 4}", async () => {
    const { callsTo } = fakeApi({
      [SETTINGS]: () => json({ ringtone: 1, ringVolume: 60 }),
      [`PATCH ${SETTINGS}`]: noContent,
    });
    open();
    await userEvent.click(await screen.findByRole("radio", { name: /Classic/ }));
    await waitFor(() => expect(callsTo("PATCH", SETTINGS)).toHaveLength(1));
    expect(callsTo("PATCH", SETTINGS)[0]?.body).toEqual({ ringtone: 4 });
  });

  it("TC-F15-52 [AC-F15-32] the volume is saved once, after the slider stops", async () => {
    const { callsTo } = fakeApi({
      [SETTINGS]: () => json({ ringtone: 1, ringVolume: 60 }),
      [`PATCH ${SETTINGS}`]: noContent,
    });
    open();
    const slider = await screen.findByLabelText("Ringtone volume");
    fireEvent.change(slider, { target: { value: "70" } });
    fireEvent.change(slider, { target: { value: "80" } });
    expect(callsTo("PATCH", SETTINGS)).toHaveLength(0);
    await waitFor(() => expect(callsTo("PATCH", SETTINGS)).toHaveLength(1));
    expect(callsTo("PATCH", SETTINGS)[0]?.body).toEqual({ ringVolume: 80 });
  });

  it("TC-F15-52 [AC-F15-32] a failed save says so", async () => {
    fakeApi({
      [SETTINGS]: () => json({ ringtone: 1, ringVolume: 60 }),
      [`PATCH ${SETTINGS}`]: () => json({ error: { code: "INTERNAL" } }, 500),
    });
    open();
    await userEvent.click(await screen.findByRole("radio", { name: /Classic/ }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
