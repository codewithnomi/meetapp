// Words and keys per system (TC-F04-85, AC-F04-60).
import { describe, expect, it } from "vitest";
import { platformWords } from "./platform-words.ts";

describe("platform words", () => {
  it("TC-F04-85 [AC-F04-60] Mac: menu bar, ⌘, Focus; Windows: notification area, Ctrl, Do not disturb", () => {
    expect(platformWords("darwin")).toEqual({ where: "menuBar", modifier: "⌘", quiet: "Focus" });
    expect(platformWords("win32")).toEqual({ where: "tray", modifier: "Ctrl", quiet: "Do not disturb" });
  });
});
