// Who may send a screen, who is disconnected and how fast, and the co-organizer limit (F02; AC-F02-25,
// 36, 49): TC-F02-51, 75, 98. TC-F02-51 reads the rights from the passes the backend signs: a raw
// LiveKit client needs a browser's WebRTC, so publishing itself is checked in the desktop tests (call.spec.ts). Real routes and database; the call server's side is recorded (a raw
// LiveKit client needs a browser's WebRTC, so the rights are read from the passes the backend signs).
// Own database; needs the `pnpm dev` services.
import { meetingCoOrganizers } from "@meetapp/db";
import { TokenVerifier, TrackSource } from "livekit-server-sdk";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ticketFingerprint } from "../../plugins/meeting-ticket.ts";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { localConfig } from "../../test-support/integration.ts";
import { recordingLiveKit, webhookBody, webhookSignature } from "../../test-support/livekit-events.ts";
import { joined, meetingWithTeam } from "../../test-support/meetings-setup.ts";
import { caller } from "../../test-support/workspaces-setup.ts";
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

describe("who may send a screen", { timeout: 30_000 }, () => {
  it("TC-F02-51 [AC-F02-25] [AC-F02-49] an attendee's pass has no screen right; a presenter's and an organizer's have", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "screen", 1, { whoCanPresent: "organizers" });
    const [attendeePerson] = members;
    if (!attendeePerson) throw new Error("member missing");
    const host = await joined(t, meeting, organizer);
    const attendee = await joined(t, meeting, attendeePerson);
    const cfg = localConfig();
    const verifier = new TokenVerifier(cfg.LIVEKIT_API_KEY, cfg.LIVEKIT_API_SECRET);
    const sourcesOf = async (who: { call?: { pass: string } }) =>
      (await verifier.verify(who.call?.pass ?? "")).video?.canPublishSources ?? [];
    expect(await sourcesOf(host)).toContain(TrackSource.SCREEN_SHARE);
    expect(await sourcesOf(attendee)).not.toContain(TrackSource.SCREEN_SHARE);
    expect(await sourcesOf(attendee)).toContain(TrackSource.MICROPHONE);
  });
});

describe("the co-organizer limit", { timeout: 30_000 }, () => {
  it("TC-F02-75 [AC-F02-36] [AC-F02-06] ten co-organizers are fine, an 11th is refused, and so is the database", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "ten", 11);
    const call = caller(t);
    const url = `/api/v1/meetings/${meeting.id}/options`;
    const ids = members.map((member) => member.id);
    expect((await call(organizer.token, "PATCH", url, { coOrganizerIds: ids.slice(0, 10) })).statusCode).toBe(200);
    expect((await call(organizer.token, "PATCH", url, { coOrganizerIds: ids })).statusCode).toBe(400);
    const eleventh = ids[10] ?? "";
    await expect(
      t.database.db.insert(meetingCoOrganizers).values({ meetingId: meeting.id, userId: eleventh }),
    ).rejects.toThrow();
    const rows = await t.database.db
      .select()
      .from(meetingCoOrganizers)
      .where(eq(meetingCoOrganizers.meetingId, meeting.id));
    expect(rows).toHaveLength(10);
  });
});

describe("disconnecting and reusing a pass", { timeout: 30_000 }, () => {
  async function room(label: string) {
    const { meeting, organizer, members } = await meetingWithTeam(t, label, 1);
    const [memberPerson] = members;
    if (!memberPerson) throw new Error("member missing");
    const host = await joined(t, meeting, organizer);
    const member = await joined(t, meeting, memberPerson);
    const { livekit, recorded } = recordingLiveKit(t.accounts.callsDeps.livekit);
    const deps = { ...t.accounts.callsDeps, livekit };
    return { host, member, recorded, callId: host.call?.callId ?? "", deps };
  }

  /** The call server connecting again with the same (still valid) pass; how long until it is removed. */
  async function reuse(deps: Awaited<ReturnType<typeof room>>["deps"], callId: string, identity: string) {
    const body = webhookBody({ event: "participant_joined", room: callId, identity });
    const started = Date.now();
    await createWebhookService(deps).receive(body, await webhookSignature(config(), body));
    return Date.now() - started;
  }

  it("TC-F02-98 [AC-F02-49] a removed person is disconnected at once and the reused pass is removed again within a second or so", async () => {
    const r = await room("removal");
    const started = Date.now();
    await createControlsService(r.deps).remove(r.callId, ticketFingerprint(r.host.ticket), r.member.attendanceId);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(r.recorded.removed).toContain(r.member.attendanceId);
    r.recorded.removed.length = 0;
    const took = await reuse(r.deps, r.callId, r.member.attendanceId);
    expect(r.recorded.removed).toEqual([r.member.attendanceId]);
    expect(took).toBeLessThan(1_500);
  });

  it("TC-F02-98 [AC-F02-49] after End meeting everyone is disconnected and a reused pass is removed", async () => {
    const r = await room("ending");
    const started = Date.now();
    await createControlsService(r.deps).end(r.callId, ticketFingerprint(r.host.ticket));
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(r.recorded.deleted).toContain(r.callId);
    const took = await reuse(r.deps, r.callId, r.member.attendanceId);
    expect(r.recorded.removed).toContain(r.member.attendanceId);
    expect(took).toBeLessThan(1_500);
  });
});
