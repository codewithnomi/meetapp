// Polls in meeting chat (F03 design.md 3.7; AC-F03-21–23). The organizer, co-organizers and
// presenters create them; everyone in the call votes. A person sees the results after voting; the
// creator, organizer and co-organizers always (as in Teams). Anonymous polls never name anyone.
import { createHmac } from "node:crypto";
import type { PollView } from "@meetapp/contracts";
import type { ChatPoll } from "./chat-polls.repository.ts";
import { AppError } from "../../plugins/errors.ts";
import { notFound, roleOf } from "../calls/admission.ts";
import { broadcast, chatActor, invalid, sentBy, viewOne, type ChatDeps } from "./chat-access.ts";

type Actor = Awaited<ReturnType<typeof chatActor>>;

export interface PollInput {
  clientId: string;
  question: string;
  options: string[];
  multiple: boolean;
  anonymous: boolean;
}

export interface OnPoll {
  callId: string;
  ticketHash: string;
  pollId: string;
}

const closedError = () => new AppError(409, "CHAT_POLL_CLOSED", "This poll is closed.");

/** The same voter gets the same key within one poll only, so votes can't be linked across polls. */
function voterKey(deps: ChatDeps, poll: ChatPoll, actor: Actor): string {
  const { attendance } = actor;
  const who = attendance.userId ?? attendance.guestDeviceHash ?? attendance.id;
  return createHmac("sha256", deps.voterSecret).update(`${poll.id}:${who}`).digest("hex");
}

const isOrganizer = (actor: Actor) => ["organizer", "co_organizer"].includes(roleOf(actor.attendance, actor.row));

async function onPoll(deps: ChatDeps, { callId, ticketHash, pollId }: OnPoll, action: "read" | "vote") {
  const actor = await chatActor(deps, callId, ticketHash, action);
  const poll = await deps.polls.byId(actor.row.meeting.id, pollId);
  if (!poll) throw notFound();
  return { actor, poll };
}

async function namesOf(deps: ChatDeps, attendanceIds: string[]): Promise<Map<string, string>> {
  const people = await Promise.all([...new Set(attendanceIds)].map((id) => deps.calls.attendances.byId(id)));
  return new Map(people.flatMap((person) => (person ? [[person.id, person.displayName] as const] : [])));
}

/** The poll as this person may see it (AC-F03-22). */
async function viewPoll(deps: ChatDeps, poll: ChatPoll, actor: Actor): Promise<PollView> {
  const options = await deps.polls.options(poll.id);
  const votes = await deps.polls.votes(poll.id);
  const key = voterKey(deps, poll, actor);
  const yourChoice = votes.filter((vote) => vote.voterKey === key).map((vote) => vote.optionId);
  const creator = poll.creatorAttendanceId ? await deps.calls.attendances.byId(poll.creatorAttendanceId) : undefined;
  const mayCount = yourChoice.length > 0 || poll.creatorAttendanceId === actor.attendance.id || isOrganizer(actor);
  const voters = new Set(votes.map((vote) => vote.voterKey)).size;
  const names = poll.anonymous
    ? new Map<string, string>()
    : await namesOf(
        deps,
        votes.flatMap((v) => (v.attendanceId ? [v.attendanceId] : [])),
      );
  const results = mayCount
    ? {
        voters,
        options: options.map((option) => {
          const chosen = votes.filter((vote) => vote.optionId === option.id);
          return {
            id: option.id,
            votes: chosen.length,
            percent: voters === 0 ? 0 : Math.round((chosen.length / voters) * 100),
            names: chosen.flatMap((vote) => {
              const name = vote.attendanceId ? names.get(vote.attendanceId) : undefined;
              return name ? [name] : [];
            }),
          };
        }),
      }
    : null;
  return {
    id: poll.id,
    messageId: poll.messageId,
    question: poll.question,
    multiple: poll.multiple,
    anonymous: poll.anonymous,
    closed: poll.closedAt !== null,
    version: poll.version,
    creatorName: creator?.displayName ?? "",
    yourChoice,
    results,
    options: options.map((option) => ({ id: option.id, text: option.text })),
  };
}

async function create(deps: ChatDeps, callId: string, ticketHash: string, input: PollInput) {
  const actor = await chatActor(deps, callId, ticketHash, "createPoll");
  const created = await deps.polls.create({
    message: { ...sentBy(actor, callId), kind: "poll", plainText: input.question, clientId: input.clientId },
    question: input.question,
    options: input.options,
    multiple: input.multiple,
    anonymous: input.anonymous,
    creatorAttendanceId: actor.attendance.id,
  });
  if (created.seq !== undefined) {
    const view = await viewOne(deps, created.message, actor.attendance.id);
    await broadcast(deps, callId, { seq: created.seq, type: "message_created", id: view.id, message: view });
  }
  return viewPoll(deps, created.poll, actor);
}

/** News of a changed poll carries only its id and version: results depend on who asks (TC-F03-39). */
async function pollChanged(deps: ChatDeps, callId: string, poll: ChatPoll, seq: number) {
  await broadcast(deps, callId, {
    seq,
    type: "poll_changed",
    id: poll.messageId,
    pollId: poll.id,
    version: poll.version + 1,
  });
}

async function vote(deps: ChatDeps, request: OnPoll, optionIds: string[]) {
  const { actor, poll } = await onPoll(deps, request, "vote");
  if (poll.closedAt) throw closedError();
  const valid = new Set((await deps.polls.options(poll.id)).map((option) => option.id));
  const chosen = [...new Set(optionIds)];
  if (chosen.some((id) => !valid.has(id)) || (!poll.multiple && chosen.length !== 1)) throw invalid();
  const ballot = {
    voterKey: voterKey(deps, poll, actor),
    attendanceId: poll.anonymous ? null : actor.attendance.id,
    optionIds: chosen,
  };
  const seq = await deps.polls.vote(poll, ballot);
  if (seq === "closed") throw closedError();
  await pollChanged(deps, request.callId, poll, seq);
  return viewPoll(deps, { ...poll, version: poll.version + 1 }, actor);
}

async function close(deps: ChatDeps, request: OnPoll) {
  const { actor, poll } = await onPoll(deps, request, "read");
  if (poll.creatorAttendanceId !== actor.attendance.id && !isOrganizer(actor)) throw notFound();
  const seq = await deps.polls.close(poll);
  if (seq !== undefined) await pollChanged(deps, request.callId, poll, seq);
}

export function createChatPollsService(deps: ChatDeps) {
  return {
    create: (callId: string, ticketHash: string, input: PollInput) => create(deps, callId, ticketHash, input),
    get: async (request: OnPoll) => {
      const { actor, poll } = await onPoll(deps, request, "read");
      return viewPoll(deps, poll, actor);
    },
    vote: (request: OnPoll, optionIds: string[]) => vote(deps, request, optionIds),
    close: (request: OnPoll) => close(deps, request),
  };
}

export type ChatPollsService = ReturnType<typeof createChatPollsService>;
