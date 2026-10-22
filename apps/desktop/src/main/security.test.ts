// Tests TC-F00-58, TC-F00-59, TC-F00-61 (AC-F00-24, security rule S17): the desktop app's lock-down rules.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEV_CSP_NONCE,
  canOpenExternally,
  canOpenHandOffStart,
  contentSecurityPolicy,
  isInsideApp,
  isTokenRoute,
  webPreferences,
} from "./security.ts";

const DEV = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:3000";

describe("webPreferences", () => {
  it("TC-F00-58 [AC-F00-24] turns the sandbox and isolation on and Node.js off", () => {
    expect(webPreferences("/p/preload.cjs")).toEqual({
      preload: "/p/preload.cjs",
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
    });
  });
});

describe("isInsideApp", () => {
  it("TC-F00-59 [AC-F00-24] accepts app://meetapp paths", () => {
    expect(isInsideApp("app://meetapp/", DEV)).toBe(true);
    expect(isInsideApp("app://meetapp/assets/a.js", DEV)).toBe(true);
  });

  it("TC-F00-59 [AC-F00-24] accepts the dev server origin only when it matches", () => {
    expect(isInsideApp(`${DEV}/home`, DEV)).toBe(true);
    expect(isInsideApp(`${DEV}/home`, "app://meetapp/")).toBe(false);
  });

  it("TC-F00-59 [AC-F00-24] rejects other origins and look-alike hosts", () => {
    const bad = [
      "https://example.com/",
      "http://127.0.0.1:51730/",
      "http://127.0.0.1:3000/",
      "app://meetapp.evil/",
      "app://meetapp",
      "app://evil/meetapp/",
      "http://127.0.0.1:5173.evil.com/",
    ];
    for (const url of bad) expect(isInsideApp(url, DEV), url).toBe(false);
  });

  it("TC-F00-59 [AC-F00-24] rejects invalid addresses and null origins", () => {
    for (const url of ["", "not a url", "about:blank", "null", "data:text/html,hi"]) {
      expect(isInsideApp(url, DEV), url).toBe(false);
    }
    expect(isInsideApp("about:blank", "about:blank")).toBe(false);
  });
});

describe("canOpenExternally", () => {
  it("TC-F00-59 [AC-F00-24] allows https only", () => {
    expect(canOpenExternally("https://example.com/x")).toBe(true);
  });

  it("TC-F00-59 [AC-F00-24] refuses every other kind of address", () => {
    const bad = [
      "http://example.com",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "mailto:a@b.com",
      "app://meetapp/",
      "garbage",
      "",
    ];
    for (const url of bad) expect(canOpenExternally(url), url).toBe(false);
  });
});

describe("contentSecurityPolicy", () => {
  const PRODUCTION =
    "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: http://127.0.0.1:3000; " +
    "connect-src 'self' http://127.0.0.1:3000 ws://127.0.0.1:3000; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

  it("TC-F00-61 [AC-F00-24] production string equals the design exactly", () => {
    expect(contentSecurityPolicy({ apiUrl: API })).toBe(PRODUCTION);
  });

  it("TC-F00-61 [AC-F00-24] development adds the ws dev origin, inline styles and only the dev server's script nonce", () => {
    const parts = contentSecurityPolicy({ apiUrl: API, devServerUrl: DEV }).split("; ");
    expect(parts).toContain("connect-src 'self' http://127.0.0.1:3000 ws://127.0.0.1:3000 ws://127.0.0.1:5173");
    expect(parts).toContain("style-src 'self' 'unsafe-inline'");
    expect(parts).toContain(`script-src 'self' 'nonce-${DEV_CSP_NONCE}'`);
  });

  it("TC-F02-113 [AC-F02-54] the call server is allowed in connect-src, and nothing else is added", () => {
    const local = contentSecurityPolicy({ apiUrl: API, callServerUrl: "ws://127.0.0.1:7880" }).split("; ");
    expect(local).toContain(
      "connect-src 'self' http://127.0.0.1:3000 ws://127.0.0.1:3000 ws://127.0.0.1:7880 http://127.0.0.1:7880",
    );
    const online = contentSecurityPolicy({ apiUrl: API, callServerUrl: "wss://calls.example.com" }).split("; ");
    expect(online).toContain(
      "connect-src 'self' http://127.0.0.1:3000 ws://127.0.0.1:3000 wss://calls.example.com https://calls.example.com",
    );
    expect(contentSecurityPolicy({ apiUrl: API, callServerUrl: "not a url" })).toBe(PRODUCTION);
  });

  it("TC-F00-61 [AC-F00-24] never allows unsafe-inline or eval for scripts", () => {
    for (const dev of [undefined, DEV]) {
      const csp = contentSecurityPolicy({ apiUrl: API, devServerUrl: dev });
      const script = csp.split("; ").find((p) => p.startsWith("script-src"));
      expect(script).not.toContain("unsafe-inline");
      expect(csp).not.toContain("unsafe-eval");
    }
    const production = contentSecurityPolicy({ apiUrl: API }).split("; ");
    expect(production).toContain("script-src 'self'");
  });

  it("the development nonce is the same one the screens' dev server uses", () => {
    const webConfig = readFileSync(new URL("../../../web/vite.config.ts", import.meta.url), "utf8");
    expect(webConfig).toContain(`DEV_CSP_NONCE = "${DEV_CSP_NONCE}"`);
  });
});

describe("isTokenRoute (F01)", () => {
  it("TC-F01-84 [AC-F01-34] the page can't call routes that hand out a token; other API routes stay open", () => {
    const blocked = [
      `${API}/api/auth/sign-in/email`,
      `${API}/api/auth/callback/google?code=1`,
      `${API}/api/v1/auth/sign-up/verify`,
      `${API}/api/v1/auth/desktop/exchange`,
      `${API}/api/v1/auth/reset-password`,
      `${API}/api/v1/me/password`,
      `${API}/API/V1/AUTH/SIGN-UP/VERIFY`,
      // Written with %-codes, which the backend decodes before matching its routes.
      `${API}/api/v1/me/p%61ssword`,
      `${API}/api/v1/auth/sign-out-%65verywhere`,
      `${API}/api/v1/%61uth/desktop/exchange`,
      `${API}/api/v1/me/%E0%A4%A`,
    ];
    for (const url of blocked) expect(isTokenRoute(url, API), url).toBe(true);
    const open = [
      `${API}/api/v1/me`,
      `${API}/api/v1/auth/providers`,
      `${API}/api/v1/flags`,
      "https://example.com/api/auth/x",
    ];
    for (const url of open) expect(isTokenRoute(url, API), url).toBe(false);
  });
});

describe("canOpenHandOffStart (F01)", () => {
  const START = "http://127.0.0.1:3010/api/v1/auth/desktop/start?request=0b6d7c1e-8f4a-4d7e-9c2b-1a2b3c4d5e6f";

  it("TC-F01-19 [AC-F01-07] development opens exactly the local start link; the packaged app only https", () => {
    expect(canOpenHandOffStart(START, false)).toBe(true);
    expect(canOpenHandOffStart(START.replace("127.0.0.1", "localhost"), false)).toBe(true);
    expect(canOpenHandOffStart(START, true)).toBe(false);
    expect(canOpenHandOffStart("https://api.example.com/api/v1/auth/desktop/start?request=x", true)).toBe(true);
    const bad = [
      "http://127.0.0.1:3010/api/v1/me",
      "http://127.0.0.1:3010/api/v1/auth/desktop/start?request=x&next=evil",
      `${START}#x`,
      START.replace("127.0.0.1", "192.168.1.5"),
      "file:///etc/passwd",
    ];
    for (const url of bad) expect(canOpenHandOffStart(url, false), url).toBe(false);
  });
  it("TC-F14-76 [AC-F14-31] the live line may reach exactly the backend's own ws/wss address", () => {
    const local = contentSecurityPolicy({ apiUrl: "http://127.0.0.1:3000" }).split("; ");
    expect(local).toContain("connect-src 'self' http://127.0.0.1:3000 ws://127.0.0.1:3000");
    const online = contentSecurityPolicy({ apiUrl: "https://api.example.com" }).split("; ");
    expect(online).toContain("connect-src 'self' https://api.example.com wss://api.example.com");
  });
});
