// Camera, microphone and screen sharing in the real app (F02 design.md section 5, AC-F02-54): TC-F02-111,
// 112, 113 and the device-key part of 114. The rules themselves (other sites, embedded frames, the
// 10-second limit) are unit-tested in apps/desktop/src/main/media-permissions.test.ts. No test here turns
// on a real camera or microphone.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { BRIDGE, bridgeKeys, closeApp, freshProfile, launch, type RunningApp } from "./desktop.ts";

interface MediaBridge {
  accessStatus: () => Promise<{ camera: string; microphone: string; screen: string }>;
  requestAccess: (kind: string) => Promise<boolean>;
  getShareSources: () => Promise<{ id: string; name: string; kind: string; thumbnail: string }[]>;
  chooseShareSource: (id: string) => Promise<{ ok: boolean }>;
}
type PageWindow = Window & { meetapp: { media: MediaBridge; deviceKey: () => Promise<string> } };

let running: RunningApp | undefined;
test.afterEach(async () => {
  if (running) await closeApp(running.app);
  running = undefined;
});

/**
 * Asks for the screen as a meeting page would, from a real click (browsers allow screen capture only
 * right after one); answers the error name, or what the stream holds.
 */
async function askForScreen(app: RunningApp): Promise<string | { video: number; audio: number }> {
  await app.page.evaluate(() => {
    document.querySelector("#share-test")?.remove();
    const button = Object.assign(document.createElement("button"), { id: "share-test", textContent: "Share" });
    button.style.cssText = "position:fixed;inset:0 auto auto 0;z-index:99999";
    button.addEventListener("click", () => {
      (window as unknown as { shared: Promise<unknown> }).shared = navigator.mediaDevices
        .getDisplayMedia({ video: true, audio: true })
        .then((stream) => {
          const answer = { video: stream.getVideoTracks().length, audio: stream.getAudioTracks().length };
          for (const track of stream.getTracks()) track.stop();
          return answer;
        })
        .catch((error: Error) => error.name);
    });
    document.body.append(button);
  });
  await app.page.click("#share-test");
  return app.page.evaluate(
    () => (window as unknown as { shared: Promise<string | { video: number; audio: number }> }).shared,
  );
}

test("TC-F02-111 [AC-F02-54] the app's page may choose the speakers; other permissions stay refused", async () => {
  running = await launch();
  const answers = await running.page.evaluate(async () => {
    const speakers = await new Audio().setSinkId("default").then(
      () => "allowed",
      (error: Error) => error.name,
    );
    const states = await Promise.all(
      (["notifications", "geolocation", "midi"] as PermissionName[]).map(
        async (name) => (await navigator.permissions.query({ name })).state,
      ),
    );
    return { speakers, states };
  });
  // Without speakers on the test computer "default" may not exist, but it must never be "not allowed".
  expect(answers.speakers).not.toBe("NotAllowedError");
  expect(answers.states).toEqual(["denied", "denied", "denied"]);
});

test("TC-F02-112 [AC-F02-54] the screen is shared only after a choice in our picker, once, without computer sound", async () => {
  running = await launch();
  const app = running;
  expect(await askForScreen(app)).toEqual(expect.any(String));
  const page = app.page;
  const status = await page.evaluate(() => (window as unknown as PageWindow).meetapp.media.accessStatus());
  expect(
    await page.evaluate(() => (window as unknown as PageWindow).meetapp.media.chooseShareSource("screen:9:9")),
  ).toEqual({ ok: false });
  // macOS asks the person before the first screen capture; that can't be answered in a test, so the
  // capture itself runs where the system allows it (Linux CI, Windows, or a Mac that already allowed it).
  test.skip(process.platform === "darwin" && status.screen !== "granted", "macOS screen recording not allowed here");
  const sources = await page.evaluate(() => (window as unknown as PageWindow).meetapp.media.getShareSources());
  const screen = sources.find((source) => source.kind === "screen");
  expect(screen?.thumbnail).toMatch(/^data:image\//);
  const chosen = await page.evaluate(
    (id) => (window as unknown as PageWindow).meetapp.media.chooseShareSource(id),
    screen?.id ?? "",
  );
  expect(chosen).toEqual({ ok: true });
  expect(await askForScreen(app)).toEqual({ video: 1, audio: 0 });
  expect(await askForScreen(app)).toEqual(expect.any(String));
});

test("TC-F02-113 [AC-F02-54] the new bridge is exactly media and deviceKey, and refuses wrong calls", async () => {
  running = await launch();
  const { page } = running;
  expect(await bridgeKeys(page)).toEqual(BRIDGE);
  const answers = await page.evaluate(async () => {
    const { media } = (window as unknown as PageWindow).meetapp;
    return {
      geolocation: await media.requestAccess("geolocation"),
      tooLong: await media.chooseShareSource("x".repeat(500)),
    };
  });
  expect(answers).toEqual({ geolocation: false, tooLong: { ok: false, code: "BAD_REQUEST" } });
});

test("TC-F02-114 [AC-F02-35] [AC-F02-54] the device key is random, 32 bytes, kept in the app's folder and reused", async () => {
  const profile = freshProfile();
  running = await launch(profile);
  const key = await running.page.evaluate(() => (window as unknown as PageWindow).meetapp.deviceKey());
  expect(Buffer.from(key, "base64url")).toHaveLength(32);
  expect(readFileSync(join(profile, "device-key"), "utf8")).toBe(key);
  await closeApp(running.app);
  running = await launch(profile);
  expect(await running.page.evaluate(() => (window as unknown as PageWindow).meetapp.deviceKey())).toBe(key);
  running = await relaunchFresh(running);
  expect(await running.page.evaluate(() => (window as unknown as PageWindow).meetapp.deviceKey())).not.toBe(key);
});

async function relaunchFresh(previous: RunningApp): Promise<RunningApp> {
  await closeApp(previous.app);
  return launch();
}
