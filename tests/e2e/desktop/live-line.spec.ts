// F14 T13 (D064): the live line in the real desktop app. Main adds the token to the upgrade to the
// backend's own address (TC-F14-76); the page can't open a line to any other host; the bridge offers
// exactly `power.onLockChange` for the locked-computer status (AC-F14-26).
import { expect, test } from "@playwright/test";
import { API_URL, BRIDGE, bridgeKeys, closeApp, launchSignedIn, type RunningApp } from "./desktop.ts";

let running: RunningApp | undefined;
test.afterEach(async () => {
  if (running) await closeApp(running.app);
  running = undefined;
});

/** Opens a WebSocket from the page and reports what happened within 5 seconds. */
function openLine(page: RunningApp["page"], url: string) {
  return page.evaluate(
    (address) =>
      new Promise<string>((resolve) => {
        let line: WebSocket;
        try {
          line = new WebSocket(address);
        } catch {
          resolve("blocked");
          return;
        }
        const timer = setTimeout(() => resolve("nothing"), 5000);
        line.addEventListener("open", () => line.send(JSON.stringify({ t: "ping" })));
        line.addEventListener("message", (event) => {
          clearTimeout(timer);
          line.close();
          resolve(String(event.data));
        });
        line.addEventListener("error", () => {
          clearTimeout(timer);
          resolve("error");
        });
      }),
    url,
  );
}

test("TC-F14-76 [AC-F14-31] the live line to the backend carries the token; no line to another host", async () => {
  running = await launchSignedIn();
  const { page } = running;
  const apiLine = `${(API_URL ?? "").replace(/^http/, "ws")}/api/v1/realtime`;
  // Signed in through main's token (the page itself never holds it): the server answers the ping.
  expect(await openLine(page, apiLine)).toBe(JSON.stringify({ t: "pong" }));
  // Another host (or another port on this computer) is refused by the security policy.
  expect(["blocked", "error"]).toContain(await openLine(page, "ws://127.0.0.1:9/api/v1/realtime"));
  expect(["blocked", "error"]).toContain(await openLine(page, "wss://example.com/api/v1/realtime"));
});

test("TC-F14-76 [AC-F14-26] the bridge adds exactly power.onLockChange", async () => {
  running = await launchSignedIn();
  expect(await bridgeKeys(running.page)).toEqual(BRIDGE);
});
