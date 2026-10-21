// Polls (F03 design.md 3.7; AC-F03-21–23; F14 AC-19). In meetings the organizer, co-organizers and
// presenters create them; in chats any member does. Everyone votes. A person sees the results after
// voting; the creator, and meeting organizers and co-organizers, always (as in Teams). Only the creator
// (or a meeting organizer) closes a poll. Anonymous polls never name anyone.
import { createHmac } from "node:crypto";
import type { PollView } from "@meetapp/contracts";
import type { ChatPoll, PollChange } from "./chat-polls.repository.ts";
import { AppError } from "../../plugins/errors.ts";
import { notFound } from "../calls/admission.ts";
import { invalid, viewOne, type ChatDeps } from "./chat-access.ts";
import { meetingSeat, seatSender, viewerOf, type ChatSeat } from "./chat-seat.ts";
import { RATE_RULES } from "../../plugins/rate-limit.ts";

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
function voterKey(deps: ChatDeps, poll: ChatPoll, seat: ChatSeat): string {
  return createHmac("sha256", deps.voterSecret).update(`${poll.id}:${seat.limitKey}`).digest("hex");
}

const isCreator = (poll: ChatPoll, seat: ChatSeat) =>
  seat.who.attendanceId !== null
    ? poll.creatorAttendanceId === seat.who.attendanceId
    : poll.creatorUserId === seat.who.userId;

/** A poll of this seat's chat; 404 when it isn't there. */
export async function pollFor(deps: ChatDeps, seat: ChatSeat, pollId: string) {
  const poll = await deps.polls.byId(seat.conversationId, pollId);
  if (!poll) throw notFound();
  return poll;
}

/** Display names of the joins and accounts that voted or created (F03: joins; F14: accounts). */
async function namesOf(deps: ChatDeps, people: { attendanceIds: string[]; userIds: string[] }) {
  const joins = await Promise.all([...new Set(people.attendanceIds)].map((id) => deps.calls.attendances.byId(id)));
  const names = await deps.polls.userNames([...new Set(people.userIds)]);
  for (const join of joins) if (join) names.set(join.id, join.displayName);
  return names;
}

type Vote = Awaited<ReturnType<ChatDeps["polls"]["votes"]>>[number];
const voterOf = (vote: Vote) => vote.attendanceId ?? vote.voterUserId;

/** The poll as this person may see it (AC-F03-22). */
export async function viewPoll(deps: ChatDeps, poll: ChatPoll, seat: ChatSeat): Promise<PollView> {
  const options = await deps.polls.options(poll.id);
  const votes = await deps.polls.votes(poll.id);
  const key = voterKey(deps, poll, seat);
  const yourChoice = votes.filter((vote) => vote.voterKey === key).map((vote) => vote.optionId);
  const shown = poll.anonymous ? [] : votes;
  const names = await namesOf(deps, {
    attendanceIds: [
      ...shown.flatMap((v) => (v.attendanceId ? [v.attendanceId] : [])),
      poll.creatorAttendanceId ?? "",
    ].filter(Boolean),
    userIds: [...shown.flatMap((v) => (v.voterUserId ? [v.voterUserId] : [])), poll.creatorUserId ?? ""].filter(
      Boolean,
    ),
  });
  const mayCount = yourChoice.length > 0 || isCreator(poll, seat) || seat.manager;
  const voters = new Set(votes.map((vote) => vote.voterKey)).size;
  const results = mayCount
    ? {
        voters,
        options: options.map((option) => {
          const chosen = votes.filter((vote) => vote.optionId === option.id);
          return {
            id: option.id,
            votes: chosen.length,
            percent: voters === 0 ? 0 : Math.round((chosen.length / voters) * 100),
            names: poll.anonymous
              ? []
              : chosen.flatMap((vote) => {
                  const name = names.get(voterOf(vote) ?? "");
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
    creatorName: names.get(poll.creatorAttendanceId ?? poll.creatorUserId ?? "") ?? "",
    yourChoice,
    results,
    options: options.map((option) => ({ id: option.id, text: option.text })),
  };
}

export async function createAs(deps: ChatDeps, seat: ChatSeat, input: PollInput) {
  const created = await deps.polls.create({
    message: { ...seatSender(seat), kind: "poll", plainText: input.question, clientId: input.clientId },
    question: input.question,
    options: input.options,
    multiple: input.multiple,
    anonymous: input.anonymous,
    creator: seat.who,
  });
  if (created.seq !== undefined) {
    const view = await viewOne(deps, created.message, viewerOf(seat));
    await seat.deliver({ seq: created.seq, type: "message_created", id: view.id, message: view });
  }
  return viewPoll(deps, created.poll, seat);
}

/** News of a changed poll carries only its id and version: results depend on who asks (TC-F03-39). */
async function pollChanged(seat: ChatSeat, poll: ChatPoll, change: PollChange) {
  await seat.deliver({
    seq: change.seq,
    type: "poll_changed",
    id: poll.messageId,
    pollId: poll.id,
    version: change.version,
  });
}

export async function voteAs(deps: ChatDeps, seat: ChatSeat, pollId: string, optionIds: string[]) {
  const poll = await pollFor(deps, seat, pollId);
  if (poll.closedAt) throw closedError();
  // Votes share the reactions' limit: 30 a minute per person (design 3.2).
  const wait = await deps.calls.limiter.take(RATE_RULES.chatReactions, seat.limitKey);
  if (wait !== undefined) throw new AppError(429, "CHAT_TOO_FAST", "Too many votes. Wait a moment.", wait);
  const valid = new Set((await deps.polls.options(poll.id)).map((option) => option.id));
  const chosen = [...new Set(optionIds)];
  if (chosen.some((id) => !valid.has(id)) || (!poll.multiple && chosen.length !== 1)) throw invalid();
  const ballot = { voterKey: voterKey(deps, poll, seat), voter: poll.anonymous ? null : seat.who, optionIds: chosen };
  const change = await deps.polls.vote(poll, ballot);
  if (change === "closed") throw closedError();
  await pollChanged(seat, poll, change);
  return viewPoll(deps, { ...poll, version: change.version }, seat);
}

export async function closeAs(deps: ChatDeps, seat: ChatSeat, pollId: string) {
  const poll = await pollFor(deps, seat, pollId);
  if (!isCreator(poll, seat) && !seat.manager) throw notFound();
  const change = await deps.polls.close(poll);
  if (change !== undefined) await pollChanged(seat, poll, change);
}

const seatFor = (deps: ChatDeps, request: OnPoll, action: "read" | "vote") =>
  meetingSeat(deps, request.callId, request.ticketHash, action);

export function createChatPollsService(deps: ChatDeps) {
  return {
    create: async (callId: string, ticketHash: string, input: PollInput) =>
      createAs(deps, await meetingSeat(deps, callId, ticketHash, "createPoll"), input),
    get: async (request: OnPoll) => {
      const seat = await seatFor(deps, request, "read");
      return viewPoll(deps, await pollFor(deps, seat, request.pollId), seat);
    },
    vote: async (request: OnPoll, optionIds: string[]) =>
      voteAs(deps, await seatFor(deps, request, "vote"), request.pollId, optionIds),
    close: async (request: OnPoll) => closeAs(deps, await seatFor(deps, request, "read"), request.pollId),
  };
}

export type ChatPollsService = ReturnType<typeof createChatPollsService>;
