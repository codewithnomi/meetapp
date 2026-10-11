// Tests TC-F00-53 (AC-F00-22: Sentry only with a DSN) and TC-F00-54 (no personal data in reports).
import { describe, expect, it, vi } from "vitest";
// The real Sentry package needs Electron to load, so it is replaced here (the start function is injected anyway).
vi.mock("@sentry/electron/main", () => ({ init: vi.fn(), IPCMode: { Classic: 1, Protocol: 2, Both: 3 } }));

import { desktopSentryOptions, safeBreadcrumb, startSentry, withoutPersonalData } from "./sentry.ts";

type Start = NonNullable<Parameters<typeof startSentry>[1]>;

describe("startSentry", () => {
  it("TC-F00-53 [AC-F00-22] does not start without a DSN", () => {
    const start = vi.fn();
    for (const dsn of [undefined, ""]) expect(startSentry(dsn, start as unknown as Start)).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });

  it("TC-F00-53 [AC-F00-22] starts once with every data category switched off", () => {
    const start = vi.fn();
    expect(startSentry("https://k@o.ingest.sentry.io/1", start as unknown as Start)).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
    const options = start.mock.calls[0]?.[0] as ReturnType<typeof desktopSentryOptions>;
    expect(options.dsn).toBe("https://k@o.ingest.sentry.io/1");
    const data = options.dataCollection as Record<string, unknown>;
    expect(data["httpBodies"]).toEqual([]);
    for (const [key, value] of Object.entries(data)) {
      if (key === "httpBodies") continue;
      const off = value === false || Object.values(value as object).every((v) => v === false);
      expect(off, key).toBe(true);
    }
  });
});

describe("withoutPersonalData", () => {
  it("TC-F00-54 [AC-F00-22] removes request data, cookies, headers, query string and user", () => {
    const event = {
      type: undefined,
      message: "boom",
      user: { email: "a@b.c" },
      request: {
        url: "https://meet.example/m/kqr-mntv-zaw?token=secret",
        data: "secret",
        cookies: { a: "b" },
        headers: { h: "v" },
        query_string: "q=1",
        method: "GET",
      },
    };
    const result = withoutPersonalData(event);
    expect(result).toEqual({
      type: undefined,
      message: "boom",
      request: { url: "https://meet.example", method: "GET" },
    });
  });

  it("TC-F00-54 [AC-F00-22] keeps events without a request and other fields", () => {
    expect(withoutPersonalData({ type: undefined, message: "x", level: "error" })).toEqual({
      type: undefined,
      message: "x",
      level: "error",
    });
  });

  it("TC-F00-54 [AC-F00-22] is the beforeSend hook", () => {
    expect(desktopSentryOptions("d").beforeSend).toBe(withoutPersonalData);
  });
});

describe("what else Sentry may see (D040)", () => {
  it("TC-F00-54 [AC-F00-22] drops console messages and cuts addresses in breadcrumbs to their origin", () => {
    expect(safeBreadcrumb({ category: "console", message: "meeting text" })).toBeNull();
    expect(safeBreadcrumb({ category: "net", data: { url: "https://meet.example/m/abc?x=1", status: 200 } })).toEqual({
      category: "net",
      data: { url: "https://meet.example", status: 200 },
    });
    expect(desktopSentryOptions("d").beforeBreadcrumb).toBe(safeBreadcrumb);
  });

  it("TC-F00-58 [AC-F00-24] gives the pages no Sentry bridge and sends no native crash dumps", () => {
    const options = desktopSentryOptions("d");
    expect(options.ipcMode).toBe(1);
    const filter = options.integrations as (defaults: { name: string }[]) => { name: string }[];
    const kept = filter(
      ["Electron", "PreloadInjection", "SentryMinidump", "ElectronMinidump", "Node"].map((name) => ({ name })),
    );
    expect(kept.map((integration) => integration.name)).toEqual(["Electron", "Node"]);
  });
});
