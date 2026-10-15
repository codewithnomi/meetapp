// Load tests (F02 T18; `pnpm test:load`, which starts the test call server and the backend first): the
// desktop app in a meeting with 99 simulated people (TC-F02-41 gallery and sound, TC-F02-25 join time)
// and with 24 (TC-F02-92 memory). The numbers are written to test-results/load-results.json; a target
// that is missed fails the test, after every number was measured.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FAKE_MEDIA, launchNewAccount } from "../e2e/desktop/desktop.ts";
import {
  appMemoryMb,
  awaitFirstSound,
  firstSoundAt,
  percentile,
  playingVideos,
  receivedFps,
  soundDelay,
  tileFps,
  watchConnections,
} from "./measure.ts";
import { simulate } from "./simulated.ts";

const RESULTS = join(import.meta.dirname, "test-results");
const JOIN_RUNS = 20;
/** The backend allows 10 joins a minute from one address (S5); runs start at least this far apart. */
const JOIN_SPACING_MS = 7_000;

function record(part: string, values: Record<string, unknown>): void {
  mkdirSync(RESULTS, { recursive: true });
  const file = join(RESULTS, "load-results.json");
  let all: Record<string, unknown> = {};
  try {
    all = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    // The first part of this run.
  }
  writeFileSync(file, JSON.stringify({ ...all, [part]: { ...values, at: new Date().toISOString() } }, null, 2));
}

// The page arrows are pressed with the keyboard: under load the tiles' contents keep changing, and a
// mouse click aimed at a moving arrow can miss it.
const controls = (page: Page) => page.getByRole("group", { name: "Meeting controls" });

/** Presses Join now and returns the call's id (the room's name on the call server). */
async function pressJoinNow(page: Page): Promise<string> {
  const answer = page.waitForResponse(
    (r) => r.url().includes("/api/v1/meetings/join") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Join now" }).click();
  const body = (await (await answer).json()) as { call?: { callId: string } };
  await expect(controls(page)).toBeVisible({ timeout: 30_000 });
  return body.call?.callId ?? "";
}

async function meetNow(page: Page): Promise<{ room: string; link: string; joinMs: number }> {
  await page.getByRole("button", { name: "Meetings" }).click();
  await page.getByRole("button", { name: "Meet now" }).click();
  const started = Date.now();
  const room = await pressJoinNow(page);
  const joinMs = Date.now() - started;
  await controls(page).getByRole("button", { name: "Meeting info" }).click();
  const link = (await page.getByText(/\/m\/[\w-]{22}$/).textContent()) ?? "";
  await controls(page).getByRole("button", { name: "Meeting info" }).click();
  return { room, link, joinMs };
}

async function waitForPeople(page: Page, count: number): Promise<void> {
  await expect(page.getByRole("button", { name: `Participants, ${String(count)}` })).toBeVisible({ timeout: 180_000 });
}

/** Leave, then come back through Meetings → Link → Join now; the time from Join now to the first sound. */
async function rejoinTime(page: Page, link: string): Promise<number> {
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  // The organizer's own Leave goes back to Meetings.
  await expect(page.getByRole("heading", { level: 1, name: "Meetings" })).toBeVisible();
  await page.getByRole("radio", { name: "Link" }).click();
  await page.getByLabel("Meeting link").fill(link);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByRole("button", { name: "Join now" })).toBeVisible();
  await awaitFirstSound(page);
  const clicked = Date.now();
  await pressJoinNow(page);
  await expect.poll(() => firstSoundAt(page), { timeout: 30_000 }).toBeDefined();
  return ((await firstSoundAt(page)) ?? Number.NaN) - clicked;
}

test("TC-F02-41 TC-F02-25 [AC-F02-20] [AC-F02-12] 100 people: 16 tiles drawn smoothly, sound on time, quick joins", async () => {
  test.setTimeout(20 * 60_000);
  const { app, page } = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  await watchConnections(page);
  const { room, link, joinMs } = await meetNow(page);
  const crowd = simulate(room, 99, join(RESULTS, "lk-100.log"));
  try {
    await waitForPeople(page, 100);
    await expect(page.getByRole("figure")).toHaveCount(16);
    await expect.poll(() => playingVideos(page), { timeout: 60_000 }).toBe(16);
    const samples: number[][] = [];
    for (let i = 0; i < 3; i += 1) {
      await page.waitForTimeout(10_000);
      samples.push(await tileFps(page));
    }
    const sent = await receivedFps(page);
    const slowest = Math.min(...samples.flat());
    await page.screenshot({ path: join(RESULTS, "hundred-people.png") });
    await page.getByRole("button", { name: "Next page" }).press("Enter");
    await expect(page.getByRole("region", { name: /page 2 of 7/ })).toBeVisible();
    await expect.poll(() => playingVideos(page), { timeout: 30_000 }).toBe(16);
    const nextPageFps = await tileFps(page);
    await page.getByRole("button", { name: "Previous page" }).press("Enter");
    const delay = await soundDelay(page);
    record("gallery", { emptyJoinMs: joinMs, tileFps: samples, receivedFps: sent, nextPageFps, slowest, delay });
    const joins: number[] = [];
    for (let i = 0; i < JOIN_RUNS; i += 1) {
      const started = Date.now();
      joins.push(await rejoinTime(page, link));
      await page.waitForTimeout(Math.max(0, JOIN_SPACING_MS - (Date.now() - started)));
    }
    const memoryMb = await appMemoryMb(app);
    const p95 = percentile(joins, 95);
    record("joins", { joins, p95, memoryMb });
    expect.soft(slowest, "every tile at 15 frames per second or more").toBeGreaterThanOrEqual(15);
    expect.soft(Math.min(...nextPageFps), "page 2 tiles at 15 fps or more").toBeGreaterThanOrEqual(15);
    expect.soft(delay.tracks, "a simulated person is heard").toBeGreaterThan(0);
    expect.soft(delay.ms, "sound delay under 250 ms").toBeLessThan(250);
    expect.soft(p95, "join time under 3 s in 95% of runs").toBeLessThan(3_000);
  } finally {
    crowd.stop();
  }
});

test("TC-F02-92 [AC-F02-47] 25 people for 5 minutes stay under 600 MB", async () => {
  test.setTimeout(15 * 60_000);
  const { app, page } = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  const { room } = await meetNow(page);
  const crowd = simulate(room, 24, join(RESULTS, "lk-25.log"));
  try {
    await waitForPeople(page, 25);
    const memory: number[] = [];
    const onPage = (n: number) =>
      expect(page.getByRole("region", { name: `Participants' video, page ${String(n)} of 2` })).toBeVisible();
    const steps = [
      async () => (await page.getByRole("button", { name: "Next page" }).press("Enter"), await onPage(2)),
      async () => (
        await onPage(2),
        await page.getByRole("button", { name: "Previous page" }).press("Enter"),
        await onPage(1)
      ),
      () => page.getByRole("radio", { name: "Speaker" }).click(),
      async () => (await page.getByRole("radio", { name: "Gallery" }).click(), await onPage(1)),
    ];
    for (let second = 0; second < 300; second += 10) {
      if (second % 30 === 0) await steps[(second / 30) % steps.length]?.();
      await page.waitForTimeout(10_000);
      memory.push(await appMemoryMb(app));
    }
    const highest = Math.max(...memory);
    record("twentyFive", { memory, highest });
    expect(highest, "Electron's memory under 600 MB").toBeLessThan(600);
  } finally {
    crowd.stop();
  }
});
