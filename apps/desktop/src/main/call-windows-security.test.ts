// F16's safety rules for the small windows (TC-F16-51, 52, 53, 55, 56, 59; AC-F16-22, 25), without
// Electron. The desktop tests check the real windows (tests/e2e/desktop/call-windows.spec.ts).
import { describe, expect, it, vi } from "vitest";
import { CALL_WINDOW_CHANNEL, CALL_WINDOWS_CHANNEL, isCallWindowAction, senderAllowed } from "./call-windows.ts";
import { validPlaces } from "./call-windows-checks.ts";
import { cleanReport } from "./call-windows-checks.ts";
import { lockDownCallWindowSession } from "./guards.ts";
import {
  CALL_WINDOW_PARTITION,
  callWindowPolicy,
  callWindowPreferences,
  contentSecurityPolicy,
  policyFor,
  smallPageAllows,
  smallWindowSetup,
} from "./security.ts";

const parts = (csp: string) => Object.fromEntries(csp.split("; ").map((p) => [p.split(" ")[0], p]));

describe("TC-F16-51 [AC-F16-22] locked-down small windows", () => {
  it("TC-F16-51 [AC-F16-22] isolation and sandbox on, Node off, own session, own preload only", () => {
    const prefs = callWindowPreferences("/app/call-window-preload.cjs");
    expect(prefs).toMatchObject({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      partition: CALL_WINDOW_PARTITION,
      preload: "/app/call-window-preload.cjs",
    });
    expect(CALL_WINDOW_PARTITION).not.toMatch(/^persist:/);
  });
});

describe("TC-F16-52 [AC-F16-22] the small windows' session refuses everything", () => {
  it("TC-F16-52 [AC-F16-22] permissions, checks, screen capture, devices and downloads are refused", () => {
    const handlers: Record<string, (...args: never[]) => unknown> = {};
    const on = vi.fn((name: string, handler: (event: { preventDefault: () => void }) => void) => {
      handlers[name] = handler as never;
    });
    const session = {
      setPermissionRequestHandler: (h: never) => (handlers["request"] = h),
      setPermissionCheckHandler: (h: never) => (handlers["check"] = h),
      setDisplayMediaRequestHandler: (h: never) => (handlers["display"] = h),
      setDevicePermissionHandler: (h: never) => (handlers["device"] = h),
      on,
      webRequest: { onHeadersReceived: vi.fn() },
    };
    lockDownCallWindowSession(session as never, undefined, callWindowPolicy());
    for (const permission of ["media", "notifications", "clipboard-read", "geolocation", "fullscreen"]) {
      const answer = vi.fn();
      (handlers["request"] as (...a: unknown[]) => void)({}, permission, answer);
      expect(answer).toHaveBeenCalledWith(false);
    }
    expect((handlers["check"] as () => boolean)()).toBe(false);
    const display = vi.fn();
    (handlers["display"] as (...a: unknown[]) => void)({}, display);
    expect(display).toHaveBeenCalledWith({});
    expect((handlers["device"] as () => boolean)()).toBe(false);
    const download = { preventDefault: vi.fn() };
    (handlers["will-download"] as (...a: unknown[]) => void)(download);
    expect(download.preventDefault).toHaveBeenCalled();
    expect(session.webRequest.onHeadersReceived).not.toHaveBeenCalled();
  });
});

describe("TC-F16-53 [AC-F16-22] the small windows' security policy", () => {
  it("TC-F16-53 [AC-F16-22] no address may be reached; pictures from the app, data: and blob: only", () => {
    const csp = parts(callWindowPolicy());
    expect(csp["connect-src"]).toBe("connect-src 'none'");
    expect(csp["img-src"]).toBe("img-src 'self' data: blob:");
    expect(csp["script-src"]).toBe("script-src 'self'");
    expect(csp["style-src"]).toBe("style-src 'self'");
    for (const rule of ["object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"])
      expect(callWindowPolicy()).toContain(rule);
    expect(callWindowPolicy()).not.toMatch(/eval|https?:|wss?:/);
  });

  it("TC-F16-53 [AC-F16-22] development allows only the dev server's live reload", () => {
    const csp = parts(callWindowPolicy("http://127.0.0.1:5173"));
    expect(csp["connect-src"]).toBe("connect-src ws://127.0.0.1:5173");
  });

  it("TC-F16-53 [AC-F16-22] only call-window.html gets the small policy", () => {
    const main = contentSecurityPolicy({ apiUrl: "http://127.0.0.1:3000" });
    const small = callWindowPolicy();
    expect(policyFor("app://meetapp/call-window.html", main, small)).toBe(small);
    expect(policyFor("app://meetapp/index.html", main, small)).toBe(main);
    expect(policyFor("app://meetapp/assets/call-window.html.js", main, small)).toBe(main);
    expect(policyFor("not a url", main, small)).toBe(main);
  });
});

describe("TC-F16-55 [AC-F16-22, AC-F16-03, AC-F16-16] allow-list and sender check", () => {
  it("TC-F16-55 [AC-F16-22] only known button presses with the right fields pass", () => {
    expect(isCallWindowAction({ name: "accept", callId: "c1", video: true })).toBe(true);
    expect(isCallWindowAction({ name: "decline", callId: "c1" })).toBe(true);
    expect(isCallWindowAction({ name: "toggleMic" })).toBe(true);
    for (const bad of [
      null,
      "accept",
      { name: "accept", callId: "c1" },
      { name: "accept", callId: "c1", video: "yes" },
      { name: "accept", callId: "c1", video: true, extra: 1 },
      { name: "decline", callId: "" },
      { name: "decline", callId: "x".repeat(101) },
      { name: "toggleMic", callId: "c1" },
      { name: "openChat", conversationId: "k1" },
      { name: "callBack", conversationId: "k1", video: true },
      { name: "constructor" },
      { name: "__proto__" },
    ])
      expect(isCallWindowAction(bad)).toBe(false);
  });

  it("TC-F16-55 [AC-F16-22] only small windows press buttons; only main windows report", () => {
    const small = new Set([7]);
    expect(senderAllowed(7, small, CALL_WINDOW_CHANNEL)).toBe(true);
    expect(senderAllowed(1, small, CALL_WINDOW_CHANNEL)).toBe(false);
    expect(senderAllowed(1, small, CALL_WINDOWS_CHANNEL)).toBe(true);
    expect(senderAllowed(7, small, CALL_WINDOWS_CHANNEL)).toBe(false);
  });

  it("TC-F16-55 [AC-F16-22] a report is checked entry by entry: bad entries are left out, never the whole report", () => {
    const good = { callId: "c1", caller: { name: "Sara", initials: "SM" }, kind: "video" };
    const evil = {
      ...good,
      callId: "c2",
      caller: { name: "Sara", initials: "SM", photo: "https://evil.example/x.png" },
    };
    const missed = {
      callId: "m1",
      from: "Sara",
      kind: "audio",
      conversationId: "k1",
      endedAt: 1,
      text: { title: "t", body: "x".repeat(201), callBack: "c" },
    };
    const clean = cleanReport({
      rings: [good, evil, ...Array.from({ length: 25 }, () => good)],
      call: { title: "x" },
      missed: [missed],
    });
    expect(clean?.rings[0]).toEqual(good);
    expect(clean?.rings.some((r) => r.callId === "c2")).toBe(false);
    expect(clean?.rings).toHaveLength(20);
    expect(clean?.call).toBeNull();
    expect(clean?.missed).toEqual([]);
    expect(cleanReport("report")).toBeUndefined();
    expect(cleanReport({ rings: [], call: null })).toBeUndefined();
    // A photo of the largest size photos.ts allows still passes.
    const big = `data:image/jpeg;base64,${"A".repeat(400_000)}`;
    expect(
      cleanReport({ rings: [{ ...good, caller: { ...good.caller, photo: big } }], call: null, missed: [] })?.rings,
    ).toHaveLength(1);
    // TC-F16-69: only PNG, JPEG or WebP photos; an SVG is dropped.
    const svg = "data:image/svg+xml;base64,PHN2Zz4=";
    expect(
      cleanReport({ rings: [{ ...good, caller: { ...good.caller, photo: svg } }], call: null, missed: [] })?.rings,
    ).toHaveLength(0);
  });
});

describe("TC-F16-56 [AC-F16-25] small windows are kept out of screen captures", () => {
  it("TC-F16-56 [AC-F16-25] content protection on, above full-screen apps, shown without focus", () => {
    const setup = smallWindowSetup("/p.cjs", { width: 360, height: 132 });
    expect(setup.contentProtection).toBe(true);
    expect(setup.showInactive).toBe(true);
    expect(setup.visibleOnFullScreen).toBe(true);
    expect(setup.alwaysOnTopLevel).toBe("pop-up-menu");
    expect(setup.options).toMatchObject({ show: false, frame: false, skipTaskbar: true, alwaysOnTop: true });
    expect(setup.options.webPreferences.partition).toBe(CALL_WINDOW_PARTITION);
  });
});

describe("TC-F16-59 [AC-F16-22, AC-F16-23] no network from the small windows", () => {
  it("TC-F16-59 [AC-F16-22] their policy can't reach the backend, the call server or any outside address", () => {
    const csp = callWindowPolicy();
    expect(csp).not.toContain("127.0.0.1");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("media-src 'none'");
  });
});

describe("T-fix-3 [AC-F16-22] the small session serves only the small page and its files", () => {
  it("T-fix-3 [AC-F16-22] call-window.html and built files yes; the main app and anything else no", () => {
    expect(smallPageAllows("app://meetapp/call-window.html")).toBe(true);
    expect(smallPageAllows("app://meetapp/assets/call-window-abc.js")).toBe(true);
    for (const url of [
      "app://meetapp/index.html",
      "app://meetapp/",
      "app://meetapp/assets/other.html",
      "app://meetapp/backgrounds/office.jpg",
      "app://meetapp/assets/../index.html",
      "not a url",
    ])
      expect(smallPageAllows(url)).toBe(false);
  });

  it("T-fix-3 [AC-F16-19] saved places keep only well-formed entries", () => {
    expect(validPlaces({ ring: { x: 1, y: 2, displayId: 3 }, mini: { x: "a" }, extra: 1 })).toEqual({
      ring: { x: 1, y: 2, displayId: 3 },
    });
    expect(validPlaces(null)).toEqual({});
    expect(validPlaces({ mini: { x: 1, y: Infinity, displayId: 1 } })).toEqual({});
  });
});
