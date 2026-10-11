// Tests the desktop settings reader used by TC-F00-53 and TC-F00-58 (AC-F00-22, AC-F00-24).
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readSettings } from "./settings.ts";

const MAIN = "/app/apps/desktop/dist/main";

describe("readSettings", () => {
  it("TC-F00-58 [AC-F00-24] uses defaults when nothing is set", () => {
    const s = readSettings({}, MAIN);
    expect(s.devServerUrl).toBeUndefined();
    expect(s.userDataDir).toBeUndefined();
    expect(s.sentryDsn).toBeUndefined();
    expect(s.apiUrl).toBe("http://127.0.0.1:3000");
  });

  it("TC-F00-58 [AC-F00-24] trims values", () => {
    const s = readSettings(
      { MEETAPP_RENDERER_URL: "  http://127.0.0.1:5173 ", VITE_API_URL: " http://127.0.0.1:3010 ", SENTRY_DSN: " d " },
      MAIN,
    );
    expect(s.devServerUrl).toBe("http://127.0.0.1:5173");
    expect(s.apiUrl).toBe("http://127.0.0.1:3010");
    expect(s.sentryDsn).toBe("d");
  });

  it("TC-F00-53 [AC-F00-22] treats empty or blank strings as unset", () => {
    const s = readSettings(
      { SENTRY_DSN: "", MEETAPP_RENDERER_URL: "   ", VITE_API_URL: "", MEETAPP_USER_DATA_DIR: " " },
      MAIN,
    );
    expect(s.sentryDsn).toBeUndefined();
    expect(s.devServerUrl).toBeUndefined();
    expect(s.userDataDir).toBeUndefined();
    expect(s.apiUrl).toBe("http://127.0.0.1:3000");
  });

  it("TC-F00-58 [AC-F00-24] resolves paths relative to the main folder", () => {
    const s = readSettings({ MEETAPP_USER_DATA_DIR: "/tmp/p" }, MAIN);
    expect(s.rendererDir).toBe(resolve(MAIN, "../../../web/dist"));
    expect(s.preloadPath).toBe(resolve(MAIN, "../preload/preload.cjs"));
    expect(s.userDataDir).toBe("/tmp/p");
  });

  it("TC-F00-58 [AC-F00-24] only a dev server on this computer can be loaded", () => {
    for (const url of ["https://evil.example", "http://192.168.1.5:5173", "file:///tmp/x.html", "javascript:alert(1)"])
      expect(readSettings({ MEETAPP_RENDERER_URL: url }, MAIN).devServerUrl).toBeUndefined();
    expect(readSettings({ MEETAPP_RENDERER_URL: "http://localhost:5173" }, MAIN).devServerUrl).toBe(
      "http://localhost:5173",
    );
  });

  it("TC-F00-58 [AC-F00-24] the backend must be on this computer or use https", () => {
    expect(readSettings({ VITE_API_URL: "http://evil.example" }, MAIN).apiUrl).toBe("http://127.0.0.1:3000");
    expect(readSettings({ VITE_API_URL: "not a url" }, MAIN).apiUrl).toBe("http://127.0.0.1:3000");
    expect(readSettings({ VITE_API_URL: "https://api.meetapp.example" }, MAIN).apiUrl).toBe(
      "https://api.meetapp.example",
    );
  });

  it("TC-F00-58 [AC-F00-24] the packaged app ignores every development and test setting", () => {
    const env = {
      MEETAPP_RENDERER_URL: "http://127.0.0.1:5173",
      VITE_API_URL: "http://127.0.0.1:3010",
      MEETAPP_USER_DATA_DIR: "/tmp/p",
    };
    const s = readSettings(env, MAIN, true);
    expect(s.devServerUrl).toBeUndefined();
    expect(s.userDataDir).toBeUndefined();
    expect(s.apiUrl).toBe("http://127.0.0.1:3000");
  });
});
