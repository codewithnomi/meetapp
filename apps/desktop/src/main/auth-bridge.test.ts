// TC-F14-76 (AC-F14-31): main adds the token only to the backend's own address, now including the
// live line's ws/wss upgrade on the same host and port, and to nothing else.
import { describe, expect, it } from "vitest";
import type { Session } from "electron";
import { applyApiAuth } from "./auth-bridge.ts";

function fakeSession() {
  const filters: string[][] = [];
  const session = {
    webRequest: {
      onBeforeRequest: (filter: { urls: string[] }) => filters.push(filter.urls),
      onBeforeSendHeaders: (filter: { urls: string[] }) => filters.push(filter.urls),
    },
  };
  return { session: session as unknown as Session, filters };
}

const tokens = { get: () => "token", set: () => undefined, clear: () => undefined };

describe("the token's addresses", () => {
  it("TC-F14-76 [AC-F14-31] local: http and ws to 127.0.0.1:3000 only", () => {
    const { session, filters } = fakeSession();
    applyApiAuth(session, "http://127.0.0.1:3000", tokens as never);
    for (const urls of filters) expect(urls).toEqual(["http://127.0.0.1:3000/*", "ws://127.0.0.1:3000/*"]);
  });

  it("TC-F14-76 [AC-F14-31] online: https and wss to the API host only", () => {
    const { session, filters } = fakeSession();
    applyApiAuth(session, "https://api.example.com", tokens as never);
    for (const urls of filters) expect(urls).toEqual(["https://api.example.com/*", "wss://api.example.com/*"]);
  });
});
