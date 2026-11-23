// Meeting emails through the real routes and queue, read back from Mailpit (F13 T5; design.md "Emails").
// Own database; needs the `pnpm dev` services.
import { meetingInvitees, meetings } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, testEmail, type AuthTestApp } from "../../test-support/auth-app.ts";
import { rawEmail, readEmail, waitForEmail } from "../../test-support/mailpit.ts";
import {
  caller,
  errorCode,
  newPerson,
  seedWorkspace,
  type Call,
  type Person,
} from "../../test-support/workspaces-setup.ts";
import { RATE_RULES } from "../../plugins/rate-limit.ts";

let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const DAY = 24 * 60 * 60 * 1000;
const SLOW = { timeout: 30_000 };
const start = new Date(Math.ceil((Date.now() + DAY) / 3_600_000) * 3_600_000);

async function team(label: string) {
  const owner = await newPerson(t, `${label}-owner`);
  const ana = await newPerson(t, `${label}-ana`);
  const workspaceId = await seedWorkspace(t, [
    [owner, "owner"],
    [ana, "member"],
  ]);
  return { owner, ana, workspaceId };
}

const body = (invitees: object[], extra: object = {}) => ({
  title: "Budget review",
  invitees,
  startsAt: start.toISOString(),
  endsAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
  allDay: false,
  timeZone: "Europe/London",
  repeat: { kind: "weekly", days: ["MO"] },
  description: "Bring numbers. Notes: https://docs.example.test/plan",
  ...extra,
});

const schedule = (who: Person, workspaceId: string, payload: object) =>
  call(who.token, "POST", `/api/v1/workspaces/${workspaceId}/scheduled-meetings`, payload);

describe("invite emails", () => {
  it(
    "TC-F13-52 [AC-F13-15, AC-F13-30] each invitee gets the meeting, the join details, a calendar file and why",
    SLOW,
    async () => {
      const { owner, ana, workspaceId } = await team("invite");
      const outside = testEmail("invite-outside");
      const since = new Date();
      const made = await schedule(owner, workspaceId, body([{ userId: ana.id }, { email: outside }]));
      expect(made.statusCode).toBe(201);
      const { meetingId } = made.json<{ meetingId: string }>();
      const [meeting] = await t.database.db.select().from(meetings).where(eq(meetings.id, meetingId));
      for (const address of [ana.email, outside]) {
        const message = await waitForEmail(address, { since, subject: /^Invitation: Budget review/ });
        const email = await readEmail(message.ID);
        expect(email.Subject).toContain("(Europe/London)");
        expect(email.Text).toContain("Bring numbers.");
        expect(email.Text).toContain(meeting?.meetingNumber ?? "missing");
        expect(email.Text).toMatch(/Repeats: Weekly on Mon/);
        expect(email.Text).toMatch(/added your address to a MeetApp meeting/);
        expect(email.HTML).toContain('<a href="https://docs.example.test/plan">');
        const parts = await rawEmail(message.ID);
        expect(parts).toMatch(/text\/calendar; charset=utf-8; method=REQUEST/);
        expect(parts.replace(/=\r?\n/g, "")).toMatch(/RRULE:FREQ=WEEKLY;BYDAY=MO/);
      }
      const rows = await t.database.db.select().from(meetingInvitees).where(eq(meetingInvitees.meetingId, meetingId));
      await expect
        .poll(async () =>
          (await t.database.db.select().from(meetingInvitees).where(eq(meetingInvitees.meetingId, meetingId))).map(
            (r) => r.emailStatus,
          ),
        )
        .toEqual(rows.map(() => "sent"));
    },
  );

  it("TC-F13-73 [AC-F13-27, AC-F13-28] typed text stays text: no extra header, recipient or calendar line", async () => {
    const { owner, workspaceId } = await team("inject");
    const outside = testEmail("inject-outside");
    const since = new Date();
    const title = "Plan <script>alert(1)</script> Bcc: evil@example.test";
    const description = "Hi\r\nBcc: evil@example.test\r\nEND:VEVENT\r\nBEGIN:VEVENT <img src=x onerror=alert(1)>";
    const made = await schedule(owner, workspaceId, body([{ email: outside }], { title, description }));
    expect(made.statusCode).toBe(201);
    const message = await waitForEmail(outside, { since, subject: /^Invitation:/ });
    expect(message.To.map((to) => to.Address)).toEqual([outside]);
    const email = await readEmail(message.ID);
    expect(email.HTML).not.toContain("<script>");
    expect(email.HTML).not.toContain("<img");
    expect(email.HTML).toContain("&lt;script&gt;");
    const raw = await rawEmail(message.ID);
    const headers = raw.split(/\r?\n\r?\n/)[0] ?? "";
    expect(headers).not.toMatch(/^Bcc:/im);
    // In the calendar file the typed lines stay inside the description, escaped (RFC 5545).
    expect(raw.replace(/=\r?\n/g, "")).toContain(String.raw`\nEND:VEVENT\nBEGIN:VEVENT`);
    const details = await call(
      owner.token,
      "GET",
      `/api/v1/meetings/${made.json<{ meetingId: string }>().meetingId}/schedule`,
    );
    expect(details.json<{ title: string; description: string }>()).toMatchObject({ title, description });
  });
});

describe("email limits", () => {
  it("TC-F13-50 [AC-F13-27] a Send over 1,000 emails an hour is refused before anything is saved", async () => {
    const { owner, ana, workspaceId } = await team("quota");
    await t.accounts.callsDeps.limiter.reserve(RATE_RULES.meetingEmails, owner.id, 1000);
    const refused = await schedule(owner, workspaceId, body([{ userId: ana.id }]));
    expect(refused.statusCode).toBe(429);
    expect(errorCode(refused)).toBe("TOO_MANY_EMAILS");
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
    expect(await t.database.db.select().from(meetings).where(eq(meetings.organizerId, owner.id))).toHaveLength(0);
    expect((await schedule(owner, workspaceId, body([]))).statusCode).toBe(201);
  });

  it("TC-F13-51 [AC-F13-27] two Sends at once can't both pass the email limit", async () => {
    const { owner, workspaceId } = await team("race");
    await t.accounts.callsDeps.limiter.reserve(RATE_RULES.meetingEmails, owner.id, 500);
    const people = (tag: string) =>
      Array.from({ length: 250 }, (_, i) => ({ email: `${tag}-${String(i)}@example.test` }));
    const both = await Promise.all([
      schedule(owner, workspaceId, body(people("a"))),
      schedule(owner, workspaceId, body(people("b"))),
      schedule(owner, workspaceId, body(people("c"))),
    ]);
    expect(both.map((r) => r.statusCode).sort()).toEqual([201, 201, 429]);
  });
});

describe("unsent invites", () => {
  it(
    "TC-F13-72 [AC-F13-31] a failed invite shows on the details, and Resend sends only it; an invitee can't",
    SLOW,
    async () => {
      const { owner, ana, workspaceId } = await team("retry");
      const outside = testEmail("retry-outside");
      const { meetingId } = (await schedule(owner, workspaceId, body([{ userId: ana.id }, { email: outside }]))).json<{
        meetingId: string;
      }>();
      const rows = () => t.database.db.select().from(meetingInvitees).where(eq(meetingInvitees.meetingId, meetingId));
      await expect
        .poll(async () => (await rows()).every((row) => row.emailStatus === "sent"), { timeout: 15_000 })
        .toBe(true);
      const failed = (await rows()).find((row) => row.userId === null);
      await t.database.db
        .update(meetingInvitees)
        .set({ emailStatus: "failed" })
        .where(eq(meetingInvitees.id, failed?.id ?? ""));
      const details = await call(owner.token, "GET", `/api/v1/meetings/${meetingId}/schedule`);
      expect(details.json<{ unsentInvites: number }>().unsentInvites).toBe(1);
      expect((await call(ana.token, "POST", `/api/v1/meetings/${meetingId}/schedule/resend`)).statusCode).toBe(403);
      const since = new Date();
      const resent = await call(owner.token, "POST", `/api/v1/meetings/${meetingId}/schedule/resend`);
      expect(resent.json<{ resent: number }>().resent).toBe(1);
      await waitForEmail(outside, { since, subject: /^Invitation:/ });
      await expect
        .poll(async () => (await rows()).every((row) => row.emailStatus === "sent"), { timeout: 15_000 })
        .toBe(true);
    },
  );
});
