// Meeting shortcuts (AC-F02-44): Cmd+Shift on a Mac, Ctrl+Shift elsewhere; nothing else triggers them.
import { describe, expect, it } from "vitest";
import { shortcutOf } from "./shortcuts.ts";

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
