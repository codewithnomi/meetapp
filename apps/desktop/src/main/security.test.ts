// Tests TC-F00-58, TC-F00-59, TC-F00-61 (AC-F00-24, security rule S17): the desktop app's lock-down rules.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEV_CSP_NONCE, canOpenExternally, contentSecurityPolicy, isInsideApp, webPreferences } from "./security.ts";

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
    "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; " +
    "connect-src 'self' http://127.0.0.1:3000; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

  it("TC-F00-61 [AC-F00-24] production string equals the design exactly", () => {
    expect(contentSecurityPolicy({ apiUrl: API })).toBe(PRODUCTION);
  });

  it("TC-F00-61 [AC-F00-24] development adds the ws dev origin, inline styles and only the dev server's script nonce", () => {
    const parts = contentSecurityPolicy({ apiUrl: API, devServerUrl: DEV }).split("; ");
    expect(parts).toContain("connect-src 'self' http://127.0.0.1:3000 ws://127.0.0.1:5173");
    expect(parts).toContain("style-src 'self' 'unsafe-inline'");
    expect(parts).toContain(`script-src 'self' 'nonce-${DEV_CSP_NONCE}'`);
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
