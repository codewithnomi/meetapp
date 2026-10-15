// What the call server reports (F02 design.md sections 3.5–3.7; AC-F02-25, 29, 32, 41, 49). Joins and
// leaves fill the meeting record; a join that isn't allowed (removed, ended, an old pass) is removed at
// once; a reconnect within 30 seconds of a dropped connection is allowed back; the newest screen share
// wins. Each report is handled once, and an older report never undoes a newer one.
import type { CallAttendance } from "./attendances.repository.ts";
import { TrackSource, type WebhookEvent } from "livekit-server-sdk";
import type { CallsDeps } from "./admission.ts";

/** A dropped connection may come back within this time without the lobby (AC-F02-29). */
const RECONNECT_MS = 30 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** May this attendance be in this room now? */
export function allowedIn(attendance: CallAttendance | undefined, room: string, now: Date): boolean {
  if (!attendance || attendance.callId !== room) return false;
  if (attendance.status === "admitted" || attendance.status === "in_call") return true;
  const droppedAgo = now.getTime() - (attendance.leftAt?.getTime() ?? 0);
  return attendance.status === "left" && attendance.leftReason === "dropped" && droppedAgo < RECONNECT_MS;
}

const eventTime = (event: WebhookEvent, fallback: Date) =>
  event.createdAt ? new Date(Number(event.createdAt) * 1000) : fallback;

async function attendanceOf(deps: CallsDeps, identity: string | undefined) {
  return identity && UUID.test(identity) ? deps.attendances.byId(identity) : undefined;
}

async function joinedRoom(deps: CallsDeps, room: string, identity: string, at: Date): Promise<void> {
  const attendance = await attendanceOf(deps, identity);
  if (attendance?.lastEventAt && at < attendance.lastEventAt) return;
  const call = attendance?.callId ? await deps.calls.byId(attendance.callId) : undefined;
  if (call && !call.endedAt && allowedIn(attendance, room, deps.now()) && attendance) {
    await deps.events.inCall(attendance.id, at);
    return;
  }
  await deps.livekit.remove(room, identity).catch(() => undefined);
}

async function leftRoom(deps: CallsDeps, identity: string, at: Date): Promise<void> {
  const attendance = await attendanceOf(deps, identity);
  if (!attendance || (attendance.lastEventAt && at < attendance.lastEventAt)) return;
  if (attendance.status === "admitted" || attendance.status === "in_call") await deps.events.dropped(attendance.id, at);
  else await deps.events.touched(attendance.id, at);
}

/** Only one screen at a time: the newest share wins; the earlier sharer is told (AC-F02-25). */
async function screenShared(deps: CallsDeps, room: string, identity: string): Promise<void> {
  const people = await deps.livekit.participants(room);
  for (const person of people) {
    if (person.identity === identity) continue;
    const screens = person.tracks.filter((track) => track.source === TrackSource.SCREEN_SHARE && !track.muted);
    for (const screen of screens) await deps.livekit.muteTrack(room, person.identity, screen.sid);
    if (screens.length > 0) await deps.livekit.sendControl(room, { type: "share_replaced" }, [person.identity]);
  }
}

export function createWebhookService(deps: CallsDeps) {
  return {
    /** Reads and checks a report (throws when the signature or body is wrong), then applies it. */
    receive: async (body: string, authorization: string | undefined): Promise<void> => {
      const event = await deps.livekit.readWebhook(body, authorization);
      if (!(await deps.events.firstTime(event.id))) return;
      const room = event.room?.name ?? "";
      const identity = event.participant?.identity ?? "";
      const at = eventTime(event, deps.now());
      if (event.event === "participant_joined") await joinedRoom(deps, room, identity, at);
      if (event.event === "participant_left") await leftRoom(deps, identity, at);
      if (event.event === "room_finished" && UUID.test(room)) await deps.events.endCall(room, "last_left", at);
      if (event.event === "track_published" && event.track?.source === TrackSource.SCREEN_SHARE) {
        await screenShared(deps, room, identity);
      }
    },
  };
}

export type WebhookService = ReturnType<typeof createWebhookService>;
