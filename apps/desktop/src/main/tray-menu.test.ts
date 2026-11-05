import { describe, expect, it } from "vitest";
import { clickOpensWindow, isTrayCommand, trayMenu, type TrayItem } from "./tray-menu.ts";

const labels = (items: TrayItem[]) => items.filter((item) => item.type !== "separator").map((item) => item.label);

describe("tray menu (F04 T4)", () => {
  it("TC-F04-11 [AC-F04-05] signed in: Open, Status with the five choices, Settings, Quit", () => {
    const menu = trayMenu(true, "MeetApp");
    expect(labels(menu)).toEqual(["Open MeetApp", "Status", "Settings", "Quit MeetApp"]);
    const status = menu.find((item) => item.label === "Status");
    expect(status?.submenu?.map((item) => item.label)).toEqual([
      "Available",
      "Busy",
      "Do not disturb",
      "Be right back",
      "Appear away",
    ]);
    expect(status?.submenu?.[2]?.choice).toEqual({ kind: "status", status: "dnd" });
  });

  it("TC-F04-11 [AC-F04-05] signed out: Open, Sign in, Quit", () => {
    expect(labels(trayMenu(false, "MeetApp"))).toEqual(["Open MeetApp", "Sign in", "Quit MeetApp"]);
  });

  it("TC-F04-11 [AC-F04-60] Windows: left click opens the window, right click the menu; Mac: always the menu", () => {
    expect(clickOpensWindow("win32", "left")).toBe(true);
    expect(clickOpensWindow("win32", "right")).toBe(false);
    expect(clickOpensWindow("darwin", "left")).toBe(false);
  });
});

describe("still running", () => {
  it("TC-F04-10 [AC-F04-04] the first-close command passes only with its place", () => {
    expect(isTrayCommand({ kind: "stillRunning", where: "menuBar" })).toBe(true);
    expect(isTrayCommand({ kind: "stillRunning", where: "tray" })).toBe(true);
    expect(isTrayCommand({ kind: "stillRunning", where: "dock" })).toBe(false);
    expect(isTrayCommand({ kind: "stillRunning" })).toBe(false);
  });
});
