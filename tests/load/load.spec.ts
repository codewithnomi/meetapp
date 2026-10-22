// Load tests (F02 T18; `pnpm test:load`, which starts the test call server and the backend first): the
// desktop app in a meeting with 99 simulated people (TC-F02-41 gallery and sound, TC-F02-25 join time)
// and with 24 (TC-F02-92 memory); chat delivery in the 100-person meeting (F03 TC-F03-02); a 250-person
// group chat delivering to the app (F14 TC-F14-42). The numbers are written to test-results/load-results.json; a target
// that is missed fails the test, after every number was measured. The simulated people run on this same
// Mac, so run it on an idle Mac (other work on it lowers every number; seen 2026-10-15).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FAKE_MEDIA, launchNewAccount } from "../e2e/desktop/desktop.ts";
import {
  addMembers,
  openLines,
  removeMembers,
  send,
  startGroup,
  userIdOf,
  workspaceIdOf,
  type Member,
} from "./chat-crowd.ts";
import { knockAsGuest } from "./chat-sender.ts";
import {
  appMemoryMb,
  chatSeen,
  awaitFirstSound,
  firstSoundAt,
  percentile,
  playingVideos,
  soundDelay,
  tileRates,
  watchChat,
  watchConnections,
  worstShare,
  type TileRate,
} from "./measure.ts";
import { simulate } from "./simulated.ts";
import { createWorkspace, openScreen } from "../e2e/desktop/workspace-steps.ts";

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

const CHAT_MESSAGES = 50;
/** Under the 10-messages-in-10-seconds limit for one sender (AC-F03-06). */
const CHAT_SPACING_MS = 1_500;

/**
 * A guest asks to join, the organizer's app lets it in, and the guest sends messages through the backend
 * while the app notes when each one shows; the delay per message (TC-F03-02).
 */
async function chatDelivery(page: Page, link: string, room: string): Promise<number[]> {
  const guest = await knockAsGuest(link, "Load Sender");
  await page.getByRole("button", { name: "Admit all" }).click();
  await controls(page).getByRole("button", { name: /^Chat/ }).click();
  await watchChat(page, "load-");
  const sender = guest.ready(room);
  const sent: Record<string, number> = {};
  for (let i = 0; i < CHAT_MESSAGES; i += 1) {
    sent[`load-${String(i)}`] = await sender.send(`load-${String(i)}`);
    await page.waitForTimeout(CHAT_SPACING_MS);
  }
  await expect.poll(async () => Object.keys(await chatSeen(page)).length, { timeout: 15_000 }).toBe(CHAT_MESSAGES);
  const seen = await chatSeen(page);
  await controls(page).getByRole("button", { name: /^Chat/ }).click();
  return Object.entries(sent).map(([text, at]) => (seen[text] ?? Number.POSITIVE_INFINITY) - at);
}

async function waitForPeople(page: Page, count: number): Promise<void> {
  await expect(page.getByRole("button", { name: `Participants, ${String(count)}` })).toBeVisible({ timeout: 180_000 });
}

/** Leave, then come back through Meetings → Link → Join now; the time from Join now to the first sound. */
async function rejoinTime(page: Page, link: string): Promise<number> {
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  // The organizer's own Leave goes back to Meetings.
  await expect(page.getByRole("heading", { level: 1, name: "Meetings" })).toBeVisible({ timeout: 15_000 });
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

test("TC-F02-41 TC-F02-25 TC-F03-02 [AC-F02-20] [AC-F02-12] [AC-F03-01] 100 people: 16 tiles drawn smoothly, sound on time, quick joins, chat on time", async () => {
  test.setTimeout(20 * 60_000);
  const { app, page } = await launchNewAccount(undefined, undefined, FAKE_MEDIA);
  await watchConnections(page);
  const { room, link, joinMs } = await meetNow(page);
  const crowd = simulate(room, 99, join(RESULTS, "lk-100.log"));
  try {
    await waitForPeople(page, 100);
    await expect(page.getByRole("figure")).toHaveCount(16);
    await expect.poll(() => playingVideos(page), { timeout: 60_000 }).toBe(16);
    const samples: TileRate[][] = [];
    for (let i = 0; i < 3; i += 1) {
      await page.waitForTimeout(10_000);
      samples.push(await tileRates(page));
    }
    const pageOne = Math.min(...samples.map(worstShare));
    await page.screenshot({ path: join(RESULTS, "hundred-people.png") });
    await page.getByRole("button", { name: "Next page" }).press("Enter");
    await expect(page.getByRole("region", { name: /page 2 of 7/ })).toBeVisible();
    await expect.poll(() => playingVideos(page), { timeout: 30_000 }).toBe(16);
    // A new page's videos start up first, as in Teams (D056: measured 5 s after the page appears).
    await page.waitForTimeout(5_000);
    const pageTwo = await tileRates(page);
    await page.getByRole("button", { name: "Previous page" }).press("Enter");
    const delay = await soundDelay(page);
    record("gallery", { emptyJoinMs: joinMs, pageOne: samples, pageTwo, delay });
    const chatDelays = await chatDelivery(page, link, room);
    const chatP95 = percentile(chatDelays, 95);
    record("chat", { delays: chatDelays, p95: chatP95 });
    const joins: number[] = [];
    for (let i = 0; i < JOIN_RUNS; i += 1) {
      const started = Date.now();
      joins.push(await rejoinTime(page, link));
      await page.waitForTimeout(Math.max(0, JOIN_SPACING_MS - (Date.now() - started)));
    }
    const memoryMb = await appMemoryMb(app);
    const p95 = percentile(joins, 95);
    record("joins", { joins, p95, memoryMb });
    expect.soft(pageOne, "every tile shows at least 90% of the frames it receives").toBeGreaterThanOrEqual(0.9);
    expect.soft(worstShare(pageTwo), "so does every tile on page 2").toBeGreaterThanOrEqual(0.9);
    expect.soft(delay.tracks, "a simulated person is heard").toBeGreaterThan(0);
    expect.soft(delay.ms, "sound delay under 250 ms").toBeLessThan(250);
    expect.soft(p95, "join time under 3 s in 95% of runs").toBeLessThan(3_000);
    expect.soft(chatP95, "chat messages shown within 1 s for 95% (AC-F03-01)").toBeLessThan(1_000);
  } finally {
    crowd.stop();
  }
});

test("TC-F02-92 [AC-F02-47] 25 people for 5 minutes stay under 700 MB", async () => {
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
    expect(highest, "Electron's memory under 700 MB (D056)").toBeLessThan(700);
  } finally {
    crowd.stop();
  }
});

const GROUP_SIZE = 250;
/** About three minutes of messages, one every 0.6 s from members in turn (well under 10 in 10 s each). */
const GROUP_MESSAGES = 300;
const GROUP_SPACING_MS = 600;

test("TC-F14-42 [AC-F14-20] a 250-person group: messages reach the app within 1 s for 95%, no line dropped", async () => {
  test.setTimeout(15 * 60_000);
  const { page, email } = await launchNewAccount(undefined, undefined, [], "Load Owner");
  const workspace = `Load ${String(Date.now())}`;
  await createWorkspace(page, "Personal", workspace);
  let members: Member[] = [];
  try {
    members = addMembers(workspace, GROUP_SIZE - 1);
    const [starter] = members;
    if (!starter) throw new Error("no simulated members");
    const everyone = [userIdOf(email), ...members.slice(1).map((m) => m.id)];
    const group = await startGroup(starter, workspaceIdOf(workspace), everyone, "Load group");
    const lines = await openLines(members, group);
    try {
      await openScreen(page, "Chat");
      await page.getByRole("button", { name: /^Load group/ }).click();
      await expect(page.getByRole("log", { name: "Messages" })).toBeVisible();
      await watchChat(page, "crowd-");
      const sent: Record<string, number> = {};
      for (let i = 0; i < GROUP_MESSAGES; i += 1) {
        const sender = members[i % members.length] ?? starter;
        const text = `crowd-${String(i)}`;
        void send(sender, group, text).then((at) => (sent[text] = at));
        await page.waitForTimeout(GROUP_SPACING_MS);
      }
      await expect.poll(async () => Object.keys(await chatSeen(page)).length, { timeout: 30_000 }).toBe(GROUP_MESSAGES);
      await expect.poll(() => Math.min(...lines.received()), { timeout: 30_000 }).toBe(GROUP_MESSAGES);
      const seen = await chatSeen(page);
      const delays = Object.entries(sent).map(([text, at]) => (seen[text] ?? Number.POSITIVE_INFINITY) - at);
      const p95 = percentile(delays, 95);
      record("group250", { delays, p95, dropped: lines.dropped(), fewestReceived: Math.min(...lines.received()) });
      expect.soft(lines.dropped(), "no live line dropped").toBe(0);
      expect.soft(p95, "messages shown in the app within 1 s for 95% (AC-F14-20)").toBeLessThan(1_000);
    } finally {
      lines.stop();
    }
  } finally {
    removeMembers(members);
  }
});
