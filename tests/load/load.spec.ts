// Load tests (F02 T18; `pnpm test:load`, which starts the test call server and the backend first): the
// desktop app in a meeting with 99 simulated people (TC-F02-41 gallery and sound, TC-F02-25 join time)
// and with 24 (TC-F02-92 memory); chat delivery in the 100-person meeting (F03 TC-F03-02); a 250-person
// group chat delivering to the app (F14 TC-F14-42); chat calls of 20 and ringing under load (F15 TC-F15-76, 77). The numbers are written to test-results/load-results.json; a target
// that is missed fails the test, after every number was measured. The simulated people run on this same
// Mac, so run it on an idle Mac (other work on it lowers every number; seen 2026-10-15).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FAKE_MEDIA, launchNewAccount } from "../e2e/desktop/desktop.ts";
import {
  acceptCall,
  joinCall,
  addMembers,
  openLines,
  openRingLines,
  removeMembers,
  send,
  startCall,
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
  // Letting in finishes on the backend a moment later: wait until the lobby is empty before sending.
  await expect(page.getByRole("button", { name: "Admit all" })).toHaveCount(0, { timeout: 15_000 });
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

const CALL_LIMIT = 20;
const JOIN_MS_LIMIT = 3_000;

test("TC-F15-76 [AC-F15-14] [AC-F15-12] a 21-person group: 20 join the call quickly, the 21st is refused", async () => {
  test.setTimeout(10 * 60_000);
  const { page, email } = await launchNewAccount(undefined, undefined, [], "Load Owner");
  const workspace = `Load ${String(Date.now())}`;
  await createWorkspace(page, "Personal", workspace);
  let members: Member[] = [];
  try {
    members = addMembers(workspace, CALL_LIMIT + 1);
    const [starter, ...others] = members;
    if (!starter) throw new Error("no simulated members");
    // 21 people in the group (a group over 20 rings nobody; they join with Join, as in the chat).
    const group = await startGroup(
      starter,
      workspaceIdOf(workspace),
      [userIdOf(email), ...others.map((m) => m.id)],
      "Call group",
    );
    const started = await startCall(starter, group);
    expect(started.status, "the call starts").toBe(201);
    const callId = started.callId ?? "";
    // Media for the call: simulated people publish video and one speaks (the 25-person approach).
    const crowd = simulate(callId, CALL_LIMIT - 1, join(RESULTS, "lk-chat-call.log"));
    try {
      const joins: number[] = [started.ms];
      for (const member of others.slice(0, CALL_LIMIT - 1)) {
        // A group of more than 20 rings nobody (AC-F15-04), so the others use Join.
        const answer = await joinCall(member, callId);
        expect(answer.status, "a seat is free").toBe(200);
        joins.push(answer.ms);
      }
      const refused = await joinCall(others[CALL_LIMIT - 1] ?? starter, callId);
      await page.waitForTimeout(20_000); // everyone publishes for a while
      const p95 = percentile(joins, 95);
      record("chatCall20", { joins, p95, refusedStatus: refused.status, refusedCode: refused.code });
      expect.soft(refused.status, "the 21st person is refused").toBe(409);
      expect.soft(refused.code, "with CALL_FULL").toBe("CALL_FULL");
      expect.soft(p95, "join answer under 3 s for 95% (F02 target)").toBeLessThan(JOIN_MS_LIMIT);
    } finally {
      crowd.stop();
    }
  } finally {
    removeMembers(members);
  }
});

const RING_GROUPS = 20;
const RING_GROUP_SIZE = 20;
/** Group g takes people g*12 .. g*12+19 of the 250 (so each person is in one or two groups). */
const RING_STRIDE = 12;

test("TC-F15-77 [AC-F15-05] [AC-F15-06] [AC-F15-34] 250 connected people, 20 groups call at once: rings under 2 s, accepts under 3 s", async () => {
  test.setTimeout(15 * 60_000);
  const { page } = await launchNewAccount(undefined, undefined, [], "Load Owner");
  const workspace = `Load ${String(Date.now())}`;
  await createWorkspace(page, "Personal", workspace);
  let members: Member[] = [];
  try {
    members = addMembers(workspace, GROUP_SIZE);
    const workspaceId = workspaceIdOf(workspace);
    const slice = (g: number) =>
      Array.from({ length: RING_GROUP_SIZE }, (_, k) => (g * RING_STRIDE + k) % members.length);
    const groups = await Promise.all(
      Array.from({ length: RING_GROUPS }, async (_, g) => {
        const people = slice(g);
        const starter = members[people[0] ?? 0];
        if (!starter) throw new Error("no starter");
        const id = await startGroup(
          starter,
          workspaceId,
          people.slice(1).map((i) => members[i]?.id ?? ""),
          `Ring group ${String(g)}`,
        );
        return { id, starter, people };
      }),
    );
    const lines = await openRingLines(members);
    try {
      const starts = await Promise.all(groups.map((g) => startCall(g.starter, g.id, "audio")));
      for (const s of starts) expect(s.status, "every call starts").toBe(201);
      await expect
        .poll(() => starts.reduce((n, s) => n + lines.rings(s.callId ?? "").length, 0), { timeout: 30_000 })
        .toBe(RING_GROUPS * (RING_GROUP_SIZE - 1));
      const delays = starts.flatMap((s) => lines.rings(s.callId ?? "").map((r) => r.at - s.sentAt));
      // One person of every group answers at once.
      const accepts = await Promise.all(
        groups.map((g, i) => {
          const person = members[g.people[1] ?? 0];
          const callId = starts[i]?.callId ?? "";
          if (!person) throw new Error("no one to answer");
          return acceptCall(person, callId, "audio");
        }),
      );
      const ringP95 = percentile(delays, 95);
      const acceptP95 = percentile(
        accepts.map((a) => a.ms),
        95,
      );
      record("ringSpeed", { delays, ringP95, accepts: accepts.map((a) => a.ms), acceptP95, dropped: lines.dropped() });
      for (const a of accepts) expect.soft(a.status, "an accept answers 200").toBe(200);
      expect.soft(lines.dropped(), "no live line dropped").toBe(0);
      expect.soft(ringP95, "rings delivered within 2 s for 95% (AC-F15-05)").toBeLessThan(2_000);
      expect.soft(acceptP95, "accepts answered within 3 s").toBeLessThan(JOIN_MS_LIMIT);
    } finally {
      lines.stop();
    }
  } finally {
    removeMembers(members);
  }
});
