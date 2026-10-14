// TC-F02-107 (AC-F02-51), security, the server's part: titles and guest names that look like HTML are
// stored and sent back exactly as typed, as JSON text, never as a web page. The screens' part (shown as
// text, no element made) is in apps/web/src/app/html-names.test.tsx. Own database; needs the `pnpm dev`
// services.
import { callAttendances } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { recordingLiveKit } from "../../test-support/livekit-events.ts";
import { joined, meetingWithTeam, newAddress, statusOf, withTicket } from "../../test-support/meetings-setup.ts";
import { ticketFingerprint } from "../../plugins/meeting-ticket.ts";
import { createControlsService } from "./controls.service.ts";

const TITLE = `<img src=x onerror=alert(1)>"&'`;
const GUEST = "<script>alert(1)</script>";
const HOST = "<b onmouseover=alert(1)>Boss</b>";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const asJson = (answer: { headers: Record<string, unknown> }) =>
  expect(String(answer.headers["content-type"])).toMatch(/^application\/json/);

describe("TC-F02-107 HTML in names and titles", { timeout: 60_000 }, () => {
  it("TC-F02-107 [AC-F02-51] the title and a guest name come back exactly as typed, as JSON text, everywhere", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "html", 0, { title: TITLE, lobbyBypass: "organizers" });
    const host = await joined(t, meeting, organizer);
    const guest = await joined(t, meeting, undefined, { guestName: GUEST });
    expect([host.title, guest.title]).toEqual([TITLE, TITLE]);
    const callId = host.call?.callId ?? "";

    const lobby = await withTicket(t, host.ticket, { method: "GET", url: `/api/v1/calls/${callId}/lobby` });
    asJson(lobby);
    expect(lobby.json<{ waiting: { name: string }[] }>().waiting.map((person) => person.name)).toEqual([GUEST]);

    await withTicket(t, host.ticket, {
      method: "POST",
      url: `/api/v1/calls/${callId}/lobby/admit`,
      payload: { attendanceIds: [guest.attendanceId] },
    });
    expect((await statusOf(t, guest)).title).toBe(TITLE);
    const info = await withTicket(t, guest.ticket, { method: "GET", url: `/api/v1/calls/${callId}/meeting` });
    asJson(info);
    expect(info.json<{ title: string }>().title).toBe(TITLE);

    // "<name> muted you" travels as data with the name as plain text.
    await t.database.db
      .update(callAttendances)
      .set({ displayName: HOST })
      .where(eq(callAttendances.id, host.attendanceId));
    const { livekit, recorded } = recordingLiveKit(t.accounts.callsDeps.livekit);
    const controls = createControlsService({
      ...t.accounts.callsDeps,
      livekit: { ...livekit, muteMicrophone: async () => true },
    });
    await controls.mute(callId, ticketFingerprint(host.ticket), guest.attendanceId);
    expect(recorded.messages.map((sent) => sent.message)).toContainEqual({ type: "muted_by", by: HOST });

    // The record lists people who connected; the call server's report would mark it.
    await t.database.db
      .update(callAttendances)
      .set({ status: "in_call", joinedAt: new Date() })
      .where(eq(callAttendances.id, guest.attendanceId));
    const record = await t.app.inject({
      method: "GET",
      url: `/api/v1/meetings/${meeting.id}/calls`,
      remoteAddress: newAddress(),
      headers: { origin: "app://meetapp", authorization: `Bearer ${organizer.token}` },
    });
    asJson(record);
    const body = record.json<{ title: string; calls: { participants: { name: string }[] }[] }>();
    expect(body.title).toBe(TITLE);
    expect(body.calls[0]?.participants.map((person) => person.name)).toContain(GUEST);
  });
});
