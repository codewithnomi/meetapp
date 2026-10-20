// Meeting shortcuts (AC-F02-44): Cmd+Shift on a Mac, Ctrl+Shift elsewhere; nothing else triggers them.
import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shortcutOf, shortcutText, useMeetingShortcuts } from "./shortcuts.ts";

const key = (k: string, extra: Partial<KeyboardEvent> = {}) => ({
  key: k,
  shiftKey: true,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...extra,
});

describe("meeting shortcuts", () => {
  it("TC-F02-89 [AC-F02-44] the Teams keys, with the right modifier per system", () => {
    expect(shortcutOf(key("M", { metaKey: true }), true)).toBe("microphone");
    expect(shortcutOf(key("o", { ctrlKey: true }), false)).toBe("camera");
    expect(shortcutOf(key("K", { metaKey: true }), true)).toBe("hand");
    expect(shortcutOf(key("M", { ctrlKey: true }), true)).toBeUndefined();
    expect(shortcutOf(key("M", { metaKey: true, shiftKey: false }), true)).toBeUndefined();
    expect(shortcutOf(key("x", { metaKey: true }), true)).toBeUndefined();
  });
});

afterEach(() => vi.unstubAllGlobals());
const platform = (name: string) => vi.stubGlobal("navigator", { platform: name, userAgent: name });

describe("meeting shortcuts on the screen", () => {
  it("TC-F02-89 [AC-F02-44] a shortcut calls the latest handler and is stopped from reaching the browser", () => {
    platform("MacIntel");
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ on }) => useMeetingShortcuts(on), { initialProps: { on: first } });
    rerender({ on: second });
    const event = new KeyboardEvent("keydown", { key: "m", metaKey: true, shiftKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(second).toHaveBeenCalledWith("microphone");
    expect(first).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "m" });
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, shiftKey: true }));
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-89 [AC-F02-44] Ctrl+Shift on other systems; Alt blocks it", () => {
    platform("Win32");
    const on = vi.fn();
    renderHook(() => useMeetingShortcuts(on));
    fireEvent.keyDown(window, { key: "o", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: "o", ctrlKey: true, shiftKey: true, altKey: true });
    expect(on.mock.calls).toEqual([["camera"]]);
  });

  it("TC-F02-89 [AC-F02-44] button labels show the keys for the system", () => {
    platform("MacIntel");
    expect(shortcutText("M")).toBe("⌘⇧M");
    platform("Win32");
    expect(shortcutText("K")).toBe("Ctrl+Shift+K");
  });
});
