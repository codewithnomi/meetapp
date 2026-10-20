// The organizer leaves and the call goes on (F02 T17; AC-F02-32). Real routes and database; the call
// server's side is recorded. Own database; needs the `pnpm dev` services.
import { callAttendances, calls } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ticketFingerprint } from "../../plugins/meeting-ticket.ts";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { localConfig } from "../../test-support/integration.ts";
import { recordingLiveKit, webhookBody, webhookSignature } from "../../test-support/livekit-events.ts";
import { joined, meetingWithTeam, statusOf, withTicket, type Joined } from "../../test-support/meetings-setup.ts";
import { createControlsService } from "./controls.service.ts";
import { createWebhookService } from "./webhook.service.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const config = () => ({ ...localConfig(), DATA_ENCRYPTION_KEY: "x".repeat(40) });
const hashOf = (person: Joined) => ticketFingerprint(person.ticket);
const statusOfError = (work: Promise<unknown>) =>
  work.then(() => 200).catch((error: { status?: number }) => error.status);

describe("the organizer leaves", { timeout: 30_000 }, () => {
  it("TC-F02-63 [AC-F02-32] the call stays running, the co-organizer keeps the controls and the attendee stays connected", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "leaves", 2);
    const [coPerson, attendeePerson] = members;
    if (!coPerson || !attendeePerson) throw new Error("people missing");
    await t.app.inject({
      method: "PATCH",
      url: `/api/v1/meetings/${meeting.id}/options`,
      payload: { coOrganizerIds: [coPerson.id] },
      headers: { origin: "app://meetapp", authorization: `Bearer ${organizer.token}` },
    });
    const host = await joined(t, meeting, organizer);
    const co = await joined(t, meeting, coPerson);
    const attendee = await joined(t, meeting, attendeePerson);
    await t.database.db
      .update(callAttendances)
      .set({ roleOverride: "attendee" })
      .where(eq(callAttendances.id, attendee.attendanceId));
    const callId = host.call?.callId ?? "";
    const { livekit, recorded } = recordingLiveKit(t.accounts.callsDeps.livekit);
    const webhooks = createWebhookService({ ...t.accounts.callsDeps, livekit });
    const controls = createControlsService({ ...t.accounts.callsDeps, livekit });
    // All three are connected to the call server.
    for (const person of [host, co, attendee]) {
      const body = webhookBody({ event: "participant_joined", room: callId, identity: person.attendanceId });
      await webhooks.receive(body, await webhookSignature(config(), body));
    }

    // The organizer presses Leave; the call server reports the connection closing.
    const left = await withTicket(t, host.ticket, {
      method: "DELETE",
      url: `/api/v1/attendances/${host.attendanceId}`,
    });
    expect(left.statusCode).toBe(204);
    const body = webhookBody({ event: "participant_left", room: callId, identity: host.attendanceId });
    await webhooks.receive(body, await webhookSignature(config(), body));

    // The call goes on: not ended, the room not deleted, the other two still connected.
    const call = (await t.database.db.select().from(calls).where(eq(calls.id, callId)))[0];
    expect(call?.endedAt).toBeNull();
    expect(recorded.deleted).toEqual([]);
    const organizerRow = (
      await t.database.db.select().from(callAttendances).where(eq(callAttendances.id, host.attendanceId))
    )[0];
    expect(organizerRow?.status).toBe("left");
    expect(organizerRow?.leftReason).toBe("leave");
    expect((await statusOf(t, co)).status).toBe("in_call");
    expect((await statusOf(t, attendee)).status).toBe("in_call");

    // The co-organizer still has the controls; the attendee still has none.
    expect(await statusOfError(controls.mute(callId, hashOf(co), attendee.attendanceId))).toBe(200);
    expect(await statusOfError(controls.lock(callId, hashOf(co), true))).toBe(200);
    expect(await statusOfError(controls.lock(callId, hashOf(co), false))).toBe(200);
    expect(await statusOfError(controls.mute(callId, hashOf(attendee), co.attendanceId))).toBe(404);
    // A new person can still join the running call.
    const late = await joined(t, meeting, coPerson);
    expect(late.call?.callId).toBe(callId);
  });
});
