// The look follows the account (TC-F01-69, AC-F01-26): at sign-in the account's theme and accent replace
// this computer's; an account without a look gets this computer's; changes are saved to the account.
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccountLook, useSaveLook } from "./account-look.ts";
import { useAppearance } from "./appearance-store.ts";

let patches: unknown[];
beforeEach(() => {
  window.localStorage.clear();
  useAppearance.getState().setAppearance({ theme: "light", accent: "blue" });
  patches = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      patches.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const html = () => document.documentElement.dataset;

describe("the look follows the account", () => {
  it("TC-F01-69 [AC-F01-26] at sign-in the account's dark and green replace this computer's light and blue", () => {
    renderHook(() => useAccountLook({ id: "u", theme: "dark", accent: "green" }));
    expect(useAppearance.getState()).toMatchObject({ theme: "dark", accent: "green" });
    expect(html()).toMatchObject({ theme: "dark", accent: "green" });
    expect(window.localStorage.getItem("meetapp.appearance")).toContain('"accent":"green"');
    expect(patches).toEqual([]);
  });

  it("TC-F01-69 [AC-F01-26] an account without a look gets this computer's, saved to it", async () => {
    renderHook(() => useAccountLook({ id: "u", theme: null, accent: null }));
    await waitFor(() => expect(patches).toEqual([{ theme: "light", accent: "blue" }]));
    expect(useAppearance.getState()).toMatchObject({ theme: "light", accent: "blue" });
  });

  it("TC-F01-69 [AC-F01-26] only once per person: later checks don't undo a change made since", () => {
    const { rerender } = renderHook(({ user }) => useAccountLook(user), {
      initialProps: { user: { id: "u", theme: "dark" as string | null, accent: "green" as string | null } },
    });
    useAppearance.getState().setTheme("light");
    rerender({ user: { id: "u", theme: "dark", accent: "green" } });
    expect(useAppearance.getState().theme).toBe("light");
  });

  it("TC-F01-69 [AC-F01-26] a bad value from the account is ignored; signed out nothing changes", () => {
    renderHook(() => useAccountLook({ id: "u", theme: "neon", accent: "teal" }));
    expect(useAppearance.getState()).toMatchObject({ theme: "light", accent: "teal" });
    renderHook(() => useAccountLook(null));
    expect(useAppearance.getState()).toMatchObject({ theme: "light", accent: "teal" });
  });

  it("TC-F01-69 [AC-F01-26] a change while signed in applies at once and is saved to the account", async () => {
    const { result } = renderHook(() => useSaveLook());
    result.current.setTheme("dark");
    result.current.setAccent("purple");
    expect(html()).toMatchObject({ theme: "dark", accent: "purple" });
    await waitFor(() => expect(patches).toEqual([{ theme: "dark" }, { accent: "purple" }]));
  });
});
