// Controls inside a call (F02 T8; design.md section 3.6; AC-F02-23, 25, 27, 33–38, 40, 50). Real routes
// and database; where a real participant would be needed, the call server's side is recorded. Own
// database; needs the `pnpm dev` services.
import { callAttendances, calls, workspaces } from "@meetapp/db";
import { TokenVerifier } from "livekit-server-sdk";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ticketFingerprint } from "../../plugins/meeting-ticket.ts";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { localConfig } from "../../test-support/integration.ts";
import { recordingLiveKit, webhookBody, webhookSignature } from "../../test-support/livekit-events.ts";
import { join, joined, meetingWithTeam, statusOf, withTicket, type Joined } from "../../test-support/meetings-setup.ts";
import { errorCode } from "../../test-support/workspaces-setup.ts";
import { createControlsService, refreshCall } from "./controls.service.ts";
import { createWebhookService } from "./webhook.service.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

/** A call with the organizer, a co-organizer, a presenter and two attendees. */
async function roomOfFive(label: string) {
  const { meeting, organizer, members } = await meetingWithTeam(t, label, 4);
  const [coPerson, presenterPerson, first, second] = members;
  if (!coPerson || !presenterPerson || !first || !second) throw new Error("people missing");
  await t.app.inject({
    method: "PATCH",
    url: `/api/v1/meetings/${meeting.id}/options`,
    payload: { coOrganizerIds: [coPerson.id] },
    headers: { origin: "app://meetapp", authorization: `Bearer ${organizer.token}` },
  });
  const host = await joined(t, meeting, organizer);
  const co = await joined(t, meeting, coPerson);
  const presenter = await joined(t, meeting, presenterPerson);
  const attendees = [await joined(t, meeting, first), await joined(t, meeting, second)];
  for (const attendee of attendees) {
    await t.database.db
      .update(callAttendances)
      .set({ roleOverride: "attendee" })
      .where(eq(callAttendances.id, attendee.attendanceId));
  }
  const callId = host.call?.callId ?? "";
  return { meeting, organizer, host, co, presenter, attendees, callId };
}

function recordedControls() {
  const { livekit, recorded } = recordingLiveKit(t.accounts.callsDeps.livekit);
  return { controls: createControlsService({ ...t.accounts.callsDeps, livekit }), recorded, livekit };
}
const hashOf = (person: Joined) => ticketFingerprint(person.ticket);
const statusOfError = (work: Promise<unknown>) =>
  work.then(() => 200).catch((error: { status?: number }) => error.status);

describe("roles decide", { timeout: 30_000 }, () => {
  it("TC-F02-67 [AC-F02-33] [AC-F02-35] [AC-F02-36] [AC-F02-37] [AC-F02-38] every control checks the caller's role and the target's", async () => {
    const room = await roomOfFive("roles");
    const { controls } = recordedControls();
    const [attendee, other] = room.attendees;
    if (!attendee || !other) throw new Error("people missing");
    const tryAs = async (who: Joined) => ({
      mute: await statusOfError(controls.mute(room.callId, hashOf(who), other.attendanceId)),
      lowerHand: await statusOfError(controls.lowerHand(room.callId, hashOf(who), other.attendanceId)),
      setRole: await statusOfError(controls.setRole(room.callId, hashOf(who), other.attendanceId, "attendee")),
      lock: await statusOfError(controls.lock(room.callId, hashOf(who), false)),
      removeOrganizer: await statusOfError(controls.remove(room.callId, hashOf(who), room.host.attendanceId)),
      roleOfOrganizer: await statusOfError(
        controls.setRole(room.callId, hashOf(who), room.host.attendanceId, "attendee"),
      ),
    });
    expect(await tryAs(room.presenter)).toEqual({
      mute: 200,
      lowerHand: 200,
      setRole: 200,
      lock: 404,
      removeOrganizer: 404,
      roleOfOrganizer: 404,
    });
    expect(await tryAs(room.co)).toEqual({
      mute: 200,
      lowerHand: 200,
      setRole: 200,
      lock: 200,
      removeOrganizer: 404,
      roleOfOrganizer: 404,
    });
    expect(await tryAs(attendee)).toEqual({
      mute: 404,
      lowerHand: 404,
      setRole: 404,
      lock: 404,
      removeOrganizer: 404,
      roleOfOrganizer: 404,
    });
    expect(await statusOfError(controls.end(room.callId, hashOf(room.presenter)))).toBe(404);
    expect(await statusOfError(controls.end(room.callId, hashOf(attendee)))).toBe(404);
  });

  it("TC-F02-46 [AC-F02-23] hands carry the time raised; own and presenters' lowering work, an attendee can't lower another's", async () => {
    const room = await roomOfFive("hands");
    const { controls, recorded } = recordedControls();
    const [first, second] = room.attendees;
    if (!first || !second) throw new Error("people missing");
    await controls.hand(room.callId, hashOf(second), true);
    await controls.hand(room.callId, hashOf(first), true);
    const raised = recorded.attributes.filter((entry) => entry.attributes["handRaisedAt"]);
    expect(raised.map((entry) => entry.identity)).toEqual([second.attendanceId, first.attendanceId]);
    await controls.hand(room.callId, hashOf(first), false);
    await controls.lowerHand(room.callId, hashOf(room.presenter), second.attendanceId);
    expect(recorded.attributes.slice(-2).map((entry) => entry.attributes["handRaisedAt"])).toEqual(["", ""]);
    expect(await statusOfError(controls.lowerHand(room.callId, hashOf(first), second.attendanceId))).toBe(404);
  });

  it("TC-F02-68 [AC-F02-33] mute tells the person who muted them; Mute all spares the person who pressed it", async () => {
    const room = await roomOfFive("mute");
    const { controls, recorded } = recordedControls();
    const [first] = room.attendees;
    if (!first) throw new Error("people missing");
    await controls.mute(room.callId, hashOf(room.presenter), first.attendanceId);
    expect(recorded.muted).toEqual([first.attendanceId]);
    expect(recorded.messages.at(-1)).toMatchObject({
      message: { type: "muted_by", by: "Test Person" },
      to: [first.attendanceId],
    });
    recorded.muted.length = 0;
    await controls.muteAll(room.callId, hashOf(room.co));
    expect(recorded.muted).toHaveLength(4);
    expect(recorded.muted).not.toContain(room.co.attendanceId);
  });

  it("TC-F02-70 [AC-F02-34] [AC-F02-36] option and role changes reach everyone's rights at once", async () => {
    const room = await roomOfFive("rights");
    const { recorded, livekit } = recordedControls();
    const deps = { ...t.accounts.callsDeps, livekit };
    const [attendee] = room.attendees;
    if (!attendee) throw new Error("people missing");
    await t.app.inject({
      method: "PATCH",
      url: `/api/v1/meetings/${room.meeting.id}/options`,
      payload: { allowAttendeeMic: false, allowAttendeeCamera: false },
      headers: { origin: "app://meetapp", authorization: `Bearer ${room.organizer.token}` },
    });
    await refreshCall(deps, room.meeting.id);
    const rightsOf = (id: string) => recorded.rights.filter((entry) => entry.identity === id).at(-1)?.sources;
    expect(rightsOf(attendee.attendanceId)).toEqual([]);
    expect(rightsOf(room.presenter.attendanceId)).toEqual(["camera", "microphone", "screen_share"]);
    expect(rightsOf(room.host.attendanceId)).toEqual(["camera", "microphone", "screen_share"]);
    await createControlsService(deps).setRole(room.callId, hashOf(room.co), attendee.attendanceId, "presenter");
    expect(rightsOf(attendee.attendanceId)).toEqual(["camera", "microphone", "screen_share"]);
    await t.app.inject({
      method: "PATCH",
      url: `/api/v1/meetings/${room.meeting.id}/options`,
      payload: { whoCanPresent: "organizers" },
      headers: { origin: "app://meetapp", authorization: `Bearer ${room.organizer.token}` },
    });
    await refreshCall(deps, room.meeting.id);
    // A role given in the call stays; people without one lose presenting (their share stops).
    expect(rightsOf(attendee.attendanceId)).toEqual(["camera", "microphone", "screen_share"]);
    expect(rightsOf(room.presenter.attendanceId)).toEqual([]);
  });

  it("TC-F02-50 [AC-F02-25] the newest screen share wins; only the earlier sharer is told", async () => {
    const room = await roomOfFive("share");
    const { livekit, recorded } = recordingLiveKit(t.accounts.callsDeps.livekit, {
      people: () => [room.host.attendanceId, room.presenter.attendanceId],
      screens: (identity) => [{ sid: `TR_${identity.slice(0, 6)}` }],
    });
    const webhooks = createWebhookService({ ...t.accounts.callsDeps, livekit });
    const config = { ...localConfig(), DATA_ENCRYPTION_KEY: "x".repeat(40) };
    const body = webhookBody({
      event: "track_published",
      room: room.callId,
      identity: room.presenter.attendanceId,
      track: { source: "SCREEN_SHARE", sid: "TR_new" },
    });
    await webhooks.receive(body, await webhookSignature(config, body));
    await webhooks.receive(body, await webhookSignature(config, body));
    expect(recorded.muted).toEqual([`TR_${room.host.attendanceId.slice(0, 6)}`]);
    expect(recorded.messages).toEqual([
      { room: room.callId, message: { type: "share_replaced" }, to: [room.host.attendanceId] },
    ]);
  });
});

describe("remove, lock and end", { timeout: 30_000 }, () => {
  it("TC-F02-72 [AC-F02-35] a removed person learns who removed them, and waits in the lobby when they come back", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "remove", 1, { lobbyBypass: "everyone" });
    const [memberPerson] = members;
    if (!memberPerson) throw new Error("member missing");
    const host = await joined(t, meeting, organizer);
    const member = await joined(t, meeting, memberPerson);
    const guest = await joined(t, meeting, undefined, { deviceKey: "g".repeat(43) });
    for (const person of [member, guest]) {
      const answer = await withTicket(t, host.ticket, {
        method: "POST",
        url: `/api/v1/calls/${host.call?.callId ?? ""}/participants/${person.attendanceId}/remove`,
      });
      expect(answer.statusCode).toBe(204);
      const now = await statusOf(t, person);
      expect(now.status).toBe("removed");
      expect(now.actedByName).toBe("Test Person");
    }
    expect((await joined(t, meeting, memberPerson)).status).toBe("waiting");
    expect((await joined(t, meeting, undefined, { deviceKey: "g".repeat(43) })).status).toBe("waiting");
    expect((await joined(t, meeting, undefined, { deviceKey: "h".repeat(43) })).status).toBe("admitted");
  });

  it("TC-F02-76 [AC-F02-37] a locked meeting turns away the lobby and new joins; organizers still get in; unlocking reopens it", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "lock", 1);
    const host = await joined(t, meeting, organizer);
    const waiting = await joined(t, meeting);
    const lock = (locked: boolean) =>
      withTicket(t, host.ticket, {
        method: "PATCH",
        url: `/api/v1/calls/${host.call?.callId ?? ""}`,
        payload: { locked },
      });
    expect((await lock(true)).statusCode).toBe(204);
    const turned = await statusOf(t, waiting);
    expect([turned.status, turned.leftReason]).toEqual(["turned_away", "locked"]);
    const [member] = members;
    if (!member) throw new Error("member missing");
    expect(errorCode(await join(t, meeting, member))).toBe("MEETING_LOCKED");
    expect((await joined(t, meeting, organizer)).status).toBe("admitted");
    await lock(false);
    expect((await joined(t, meeting, member)).status).toBe("admitted");
  });

  it("TC-F02-78 [AC-F02-38] End meeting sends everyone away, the lobby too; a later join starts a new call", async () => {
    const room = await roomOfFive("end");
    const waiting = await joined(t, room.meeting);
    const [attendee] = room.attendees;
    if (!attendee) throw new Error("attendee missing");
    const end = (who: Joined) => withTicket(t, who.ticket, { method: "POST", url: `/api/v1/calls/${room.callId}/end` });
    expect((await end(attendee)).statusCode).toBe(404);
    expect((await end(room.co)).statusCode).toBe(204);
    const [call] = await t.database.db.select().from(calls).where(eq(calls.id, room.callId));
    expect(call?.endReason).toBe("ended");
    for (const person of [room.presenter, waiting]) {
      const now = await statusOf(t, person);
      expect([now.status, now.leftReason]).toEqual(["left", "ended"]);
    }
    const again = await joined(t, room.meeting, room.organizer);
    expect(again.call?.callId).not.toBe(room.callId);
  });

  it("TC-F02-82 [AC-F02-40] guests switched off: the lobby guest is turned away, the guest inside stays, new guests are refused", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "guestsoff", 0, { lobbyBypass: "everyone" });
    await joined(t, meeting, organizer);
    const inside = await joined(t, meeting);
    await t.app.inject({
      method: "PATCH",
      url: `/api/v1/meetings/${meeting.id}/options`,
      payload: { lobbyBypass: "workspace" },
      headers: { origin: "app://meetapp", authorization: `Bearer ${organizer.token}` },
    });
    const waiting = await joined(t, meeting);
    await t.database.db.update(workspaces).set({ allowGuests: false }).where(eq(workspaces.id, meeting.workspaceId));
    const turned = await statusOf(t, waiting);
    expect([turned.status, turned.leftReason]).toEqual(["turned_away", "guests_off"]);
    expect((await statusOf(t, inside)).status).toBe("admitted");
  });
});

describe("what people can see", { timeout: 30_000 }, () => {
  it("TC-F02-53 [AC-F02-27] passes carry names and an account id, never an email; guests have no account id", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "names", 0, { lobbyBypass: "everyone" });
    const host = await joined(t, meeting, organizer);
    const guest = await joined(t, meeting);
    const config = localConfig();
    const verifier = new TokenVerifier(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);
    const hostClaims = await verifier.verify(host.call?.pass ?? "");
    const guestClaims = await verifier.verify(guest.call?.pass ?? "");
    expect(hostClaims.attributes).toMatchObject({ role: "organizer", group: "member", userId: organizer.id });
    expect(guestClaims.attributes?.["userId"]).toBeUndefined();
    expect(JSON.stringify([hostClaims, guestClaims])).not.toContain("@");
  });

  it("TC-F02-103 [AC-F02-50] Meeting info only for people in the call; organizer-only reads stay closed to others", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "info", 1);
    const host = await joined(t, meeting, organizer);
    const [memberPerson] = members;
    if (!memberPerson) throw new Error("member missing");
    const member = await joined(t, meeting, memberPerson);
    const waiting = await joined(t, meeting);
    const info = (who: Joined) =>
      withTicket(t, who.ticket, { method: "GET", url: `/api/v1/calls/${host.call?.callId ?? ""}/meeting` });
    const seen = (await info(member)).json<{ passcode: string; link: string }>();
    expect(seen.passcode).toBe(meeting.passcode);
    expect((await info(waiting)).statusCode).toBe(404);
    const asMember = await t.app.inject({
      method: "GET",
      url: `/api/v1/meetings/${meeting.id}`,
      headers: { origin: "app://meetapp", authorization: `Bearer ${memberPerson.token}` },
    });
    expect(asMember.statusCode).toBe(404);
    expect((await statusOf(t, waiting)).call).toBeUndefined();
    expect(JSON.stringify(await statusOf(t, waiting))).not.toContain(meeting.passcode);
  });
});
