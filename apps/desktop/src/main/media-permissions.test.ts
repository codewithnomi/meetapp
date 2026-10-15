// The rules behind TC-F02-111 and TC-F02-112 (AC-F02-54), checked without Electron. The desktop tests
// (tests/e2e/desktop/media.spec.ts) check the same rules in a real window.
import { describe, expect, it } from "vitest";
import { createMediaActions, isValidMediaCall } from "./media-actions.ts";
import { allowsCheck, allowsRequest, createSharePicker, shareAnswer } from "./media-permissions.ts";

const APP = "app://meetapp/index.html";
const DEV = "http://127.0.0.1:5173";
const own = { url: "app://meetapp/index.html#/meeting", isMainFrame: true };

describe("TC-F02-111 [AC-F02-54] permission rules", () => {
  it("TC-F02-111 [AC-F02-54] the app's own page gets camera, microphone and screen capture", () => {
    expect(allowsRequest({ ...own, permission: "media", mediaTypes: ["audio", "video"] }, APP)).toBe(true);
    expect(allowsRequest({ ...own, permission: "media", mediaTypes: ["audio"] }, APP)).toBe(true);
    expect(allowsRequest({ ...own, permission: "display-capture", mediaTypes: ["video"] }, APP)).toBe(true);
    // Electron 44 reports a screen request as "media" with no media types.
    expect(allowsRequest({ ...own, permission: "media", mediaTypes: [] }, APP)).toBe(true);
    expect(allowsRequest({ url: `${DEV}/`, isMainFrame: true, permission: "media", mediaTypes: ["video"] }, DEV)).toBe(
      true,
    );
  });

  it("TC-F02-111 [AC-F02-54] every other permission is refused, even for the app's own page", () => {
    const others = [
      "notifications",
      "geolocation",
      "clipboard-read",
      "midi",
      "pointerLock",
      "hid",
      "usb",
      "serial",
      "openExternal",
      "fullscreen",
    ];
    for (const permission of others) expect(allowsRequest({ ...own, permission }, APP), permission).toBe(false);
    expect(allowsRequest({ ...own, permission: "media", mediaTypes: ["unknown"] }, APP)).toBe(false);
  });

  it("TC-F02-111 [AC-F02-54] other sites, embedded frames and the dev server outside development are refused", () => {
    const camera = { permission: "media", mediaTypes: ["video"], isMainFrame: true };
    for (const url of ["https://evil.example/", "app://other/index.html", "file:///tmp/a.html", "data:text/html,x", ""])
      expect(allowsRequest({ ...camera, url }, APP), url).toBe(false);
    expect(allowsRequest({ ...camera, url: `${DEV}/` }, APP)).toBe(false);
    expect(allowsRequest({ ...camera, ...own, isMainFrame: false }, APP)).toBe(false);
  });

  it("TC-F02-111 [AC-F02-54] checks: media and speaker selection for the app's page only", () => {
    expect(allowsCheck({ ...own, permission: "media" }, APP)).toBe(true);
    expect(allowsCheck({ ...own, permission: "speaker-selection" }, APP)).toBe(true);
    for (const permission of ["notifications", "usb", "serial", "hid", "clipboard-read"])
      expect(allowsCheck({ ...own, permission }, APP), permission).toBe(false);
    expect(allowsCheck({ url: "https://evil.example/", isMainFrame: true, permission: "media" }, APP)).toBe(false);
    expect(allowsCheck({ ...own, isMainFrame: false, permission: "speaker-selection" }, APP)).toBe(false);
  });
});

describe("TC-F02-112 [AC-F02-54] screen sharing only through our picker", () => {
  const screen = { id: "screen:1:0", name: "Entire screen" };
  const fromApp = { securityOrigin: "app://meetapp", fromTopFrame: true };

  it("TC-F02-112 [AC-F02-54] without a choice the request is refused; with one it gets exactly that source, once", () => {
    const picker = createSharePicker();
    expect(shareAnswer(picker, fromApp, APP)).toBeNull();
    picker.choose(screen);
    const answer = shareAnswer(picker, fromApp, APP);
    expect(answer).toEqual({ video: screen });
    expect(answer).not.toHaveProperty("audio");
    expect(shareAnswer(picker, fromApp, APP)).toBeNull();
  });

  it("TC-F02-112 [AC-F02-54] a choice older than 10 seconds is refused", () => {
    let now = 1_000;
    const picker = createSharePicker(() => now);
    picker.choose(screen);
    now += 10_001;
    expect(shareAnswer(picker, fromApp, APP)).toBeNull();
  });

  it("TC-F02-112 [AC-F02-54] another site or an embedded frame never gets the chosen source, and uses it up", () => {
    const picker = createSharePicker();
    picker.choose(screen);
    expect(shareAnswer(picker, { securityOrigin: "https://evil.example", fromTopFrame: true }, APP)).toBeNull();
    expect(shareAnswer(picker, { ...fromApp, fromTopFrame: false }, APP)).toBeNull();
    expect(shareAnswer(picker, fromApp, APP)).toEqual({ video: screen });
  });
});

describe("TC-F02-112 [AC-F02-54] the share picker's list", () => {
  it("TC-F02-112 [AC-F02-54] the page sees stand-in ids; only a listed one can be chosen, and the picker gets the real one", async () => {
    const picker = createSharePicker();
    const system = {
      status: () => "granted",
      ask: async () => true,
      sources: async () => [
        { id: "screen:1:0", name: "Entire screen", kind: "screen" as const, thumbnail: "data:image/png;base64,x" },
        { id: "window:42:0", name: "Notes", kind: "window" as const, thumbnail: "data:image/png;base64,y" },
      ],
      deviceKey: () => "key",
    };
    const actions = createMediaActions(system, picker);
    expect(actions.chooseShareSource("share-1")).toEqual({ ok: false });
    const listed = await actions.getShareSources();
    expect(listed.map((source) => source.id)).toEqual(["share-1", "share-2"]);
    expect(JSON.stringify(listed)).not.toContain("screen:1:0");
    expect(actions.chooseShareSource("screen:1:0")).toEqual({ ok: false });
    expect(actions.chooseShareSource("share-2")).toEqual({ ok: true });
    expect(picker.take()).toEqual({ id: "window:42:0", name: "Notes" });
  });

  it("TC-F02-113 [AC-F02-54] only the listed actions with the right arguments are accepted", () => {
    expect(isValidMediaCall("accessStatus", [])).toBe(true);
    expect(isValidMediaCall("chooseShareSource", ["share-1"])).toBe(true);
    expect(isValidMediaCall("chooseShareSource", [{}])).toBe(false);
    expect(isValidMediaCall("chooseShareSource", ["x".repeat(201)])).toBe(false);
    expect(isValidMediaCall("deviceKey", ["extra"])).toBe(false);
    expect(isValidMediaCall("constructor", [])).toBe(false);
    expect(isValidMediaCall("accessStatus", "not a list")).toBe(false);
  });
});
