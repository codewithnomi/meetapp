// Background work for calls (F02 design.md sections 3.4, 3.7 and "Edge cases"; AC-F02-18, 39, 49). Every
// minute a clean-up times out forgotten lobby waits, and compares running calls with the call server's
// rooms and participants, so a lost report never leaves a call open or a removed person inside. Each call
// gets two delayed jobs: "ending soon" 10 minutes before 30 hours, and the end at 30 hours. All are safe
// to run twice.
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import type { Call } from "@meetapp/db";
import { CALL_LIMIT_MS, LOBBY_WAIT_MS, type CallsDeps } from "./admission.ts";
import { allowedIn, isAttendanceId } from "./webhook.service.ts";

const QUEUE = "calls";
const CLEAN_UP = "clean-up";
const WARNING_BEFORE_MS = 10 * 60 * 1000;
const START_GRACE_MS = 60 * 1000;
const EVENTS_KEPT_MS = 24 * 60 * 60 * 1000;
const SIMULATED = "sim_";

/** People inside the call server who shouldn't be, and people marked inside who aren't (lost reports). */
async function repairCall(deps: CallsDeps, call: Call, now: Date, keepSimulated: boolean): Promise<void> {
  const people = await deps.livekit.participants(call.id);
  for (const person of people) {
    // The load test's simulated people (`lk load-test`), only when the load test asks (never in production).
    if (keepSimulated && person.identity.startsWith(SIMULATED)) continue;
    // Someone the backend never let in (not an attendance id) goes at once.
    const attendance = isAttendanceId(person.identity) ? await deps.attendances.byId(person.identity) : undefined;
    if (!allowedIn(attendance, call.id, now)) {
      await deps.livekit.remove(call.id, person.identity).catch(() => undefined);
    }
  }
  const present = new Set(people.map((person) => person.identity));
  // Marked inside but not there (a lost report), or let in but never connected (closed the app, the
  // connection failed): their place is freed, so they don't count toward the 100 (AC-F02-42).
  for (const attendance of await deps.attendances.presentIn(call.id)) {
    const since = attendance.status === "in_call" ? attendance.lastEventAt : attendance.admittedAt;
    const quietFor = now.getTime() - (since ?? attendance.updatedAt).getTime();
    if (!present.has(attendance.id) && quietFor > START_GRACE_MS) await deps.events.dropped(attendance.id, now);
  }
}

/** A call with no room: ended once a minute has passed since it started and since anyone was let in. */
async function abandoned(deps: CallsDeps, call: Call, now: Date): Promise<boolean> {
  const within = (at: Date | null | undefined) =>
    at !== null && at !== undefined && now.getTime() - at.getTime() <= START_GRACE_MS;
  if (within(call.startedAt)) return false;
  const present = await deps.attendances.presentIn(call.id);
  return !present.some((attendance) => attendance.status === "admitted" && within(attendance.admittedAt));
}

interface CallJobOptions {
  keepSimulated?: boolean;
  /** More clean-up for the same minute-by-minute job (F03 chat); its failure doesn't stop the calls' one. */
  alsoCleanUp?: () => Promise<void>;
}

export function createCallJobs(deps: CallsDeps, { keepSimulated = false, alsoCleanUp }: CallJobOptions = {}) {
  return {
    cleanUp: async (): Promise<void> => {
      const now = deps.now();
      await deps.events.timeOutWaiting(new Date(now.getTime() - LOBBY_WAIT_MS));
      await deps.events.forgetEventsBefore(new Date(now.getTime() - EVENTS_KEPT_MS));
      const rooms = new Set(await deps.livekit.runningRooms());
      for (const call of await deps.events.runningCalls()) {
        // One call that fails doesn't stop the others; the next round tries it again.
        if (rooms.has(call.id)) await repairCall(deps, call, now, keepSimulated).catch(() => undefined);
        else if (await abandoned(deps, call, now)) {
          await deps.events.endCall(call.id, "last_left", now).catch(() => undefined);
        }
      }
      await alsoCleanUp?.().catch(() => undefined);
    },
    /** 10 minutes before 30 hours, everyone is told (once, AC-F02-39). */
    endingSoon: async (callId: string): Promise<void> => {
      const call = await deps.calls.byId(callId);
      if (!call || call.endedAt) return;
      const endsAt = call.startedAt.getTime() + CALL_LIMIT_MS;
      if (deps.now().getTime() < endsAt - WARNING_BEFORE_MS) return;
      if (!(await deps.events.firstTime(`ending-soon:${callId}`))) return;
      await deps.livekit.sendControl(callId, { type: "ending_soon", endsAt: new Date(endsAt).toISOString() });
    },
    /** At 30 hours the call ends for everyone (AC-F02-39). */
    timeLimit: async (callId: string): Promise<void> => {
      const call = await deps.calls.byId(callId);
      if (!call || call.endedAt) return;
      if (deps.now().getTime() < call.startedAt.getTime() + CALL_LIMIT_MS) return;
      if (await deps.events.endCall(callId, "time_limit", deps.now())) {
        await deps.livekit.deleteRoom(callId).catch(() => undefined);
      }
    },
  };
}

export type CallJobs = ReturnType<typeof createCallJobs>;

/** Runs the jobs on BullMQ (started by server.ts); `schedule` is given to the join service. */
export async function startCallJobs(connection: ConnectionOptions, jobs: CallJobs) {
  const queue = new Queue(QUEUE, { connection });
  const worker = new Worker(
    QUEUE,
    async (job) => {
      const { callId } = job.data as { callId?: string };
      if (job.name === CLEAN_UP) await jobs.cleanUp();
      else if (job.name === "ending-soon" && callId) await jobs.endingSoon(callId);
      else if (job.name === "time-limit" && callId) await jobs.timeLimit(callId);
    },
    { connection },
  );
  const done = { removeOnComplete: true, removeOnFail: { age: 86_400 } };
  await queue.upsertJobScheduler(CLEAN_UP, { every: 60_000 }, { name: CLEAN_UP, opts: done });
  return {
    schedule: async (call: Call): Promise<void> => {
      const startedAt = call.startedAt.getTime();
      const after = (at: number) => Math.max(0, at - Date.now());
      const data = { callId: call.id };
      const limit = startedAt + CALL_LIMIT_MS;
      await queue.add("ending-soon", data, {
        ...done,
        jobId: `${call.id}-ending-soon`,
        delay: after(limit - WARNING_BEFORE_MS),
      });
      await queue.add("time-limit", data, { ...done, jobId: `${call.id}-time-limit`, delay: after(limit) });
    },
    close: async () => {
      await worker.close();
      await queue.close();
    },
  };
}
