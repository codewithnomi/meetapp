// Chat requests and blocking (F14 design.md 3.7; AC-F14-10–13, 27): a chat with someone outside the
// workspace (everyone, from Personal) waits until they accept, as in Teams. They can preview, accept,
// delete (the sender isn't told; no new request for 30 days) or block. 20 new requests a day; a request
// not answered in 30 days is hidden when read and tidied by the clean-up. Only external people can be
// blocked; a blocked person can't start chats with the blocker and their direct chat turns read-only.
import type { ConversationKind } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";
import type { Membership } from "../workspaces/workspaces.permissions.ts";
import type { ChatRepository } from "../chat/chat.repository.ts";
import { saveNote } from "./chats-notes.ts";
import { canChats, type ChatsAction } from "./chats.permissions.ts";
import { directKeyOf, type ChatsRepository, type Conversation } from "./chats.repository.ts";
import type { ChatsRequestsRepository } from "./chats-requests.repository.ts";

/** Who asks and from which workspace. */
export type Place = Pick<Membership, "userId" | "workspaceId" | "kind">;

export interface RequestsDeps {
  chat: ChatRepository;
  chats: ChatsRepository;
  requests: ChatsRequestsRepository;
  limiter: RateLimiter;
  now: () => Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const REQUEST_DAYS = 30;
const PREVIEW_MESSAGES = 10;
const KIND_LINES: Record<string, string> = { gif: "GIF", sticker: "Sticker", poll: "Poll", file: "File" };

/** Requests sent before this moment have expired (AC-F14-12). */
export const requestCutoff = (now: Date) => new Date(now.getTime() - REQUEST_DAYS * DAY_MS);
const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");
const photoOf = (person: { userId: string; avatarKey: string | null }) =>
  person.avatarKey ? `/api/v1/users/${person.userId}/avatar?v=${person.avatarKey}` : null;

async function takeRequest(deps: RequestsDeps, userId: string) {
  const wait = await deps.limiter.take(RATE_RULES.chatRequests, userId);
  if (wait !== undefined) {
    throw new AppError(429, "TOO_MANY_ATTEMPTS", "You can send 20 new chat requests a day.", wait);
  }
}

/** An existing direct chat: open it, or ask again when the old request expired or the wait is over. */
async function reopen(deps: RequestsDeps, conversation: Conversation, starterId: string, targetId: string) {
  const other = await deps.chats.member(conversation.id, targetId);
  const now = deps.now();
  const waiting = other?.member.state === "pending" && (other.member.requestedAt ?? now) > requestCutoff(now);
  if (!other || other.member.state === "accepted" || waiting) return { id: conversation.id, created: false };
  if (other.member.state !== "pending" && other.member.state !== "declined") throw notFound();
  await takeRequest(deps, starterId);
  await deps.requests.setState(conversation.id, targetId, { state: "pending", requestedAt: now });
  return { id: conversation.id, created: false };
}

/** Someone outside may be asked from here (AC-F14-13, 27): they exist, neither blocked the other, outside
 * chat is on both sides and no 30-day wait is running. Anything else is refused like "not found". */
export async function assertReachable(deps: RequestsDeps, place: Place, targetId: string) {
  const { userId, workspaceId } = place;
  const refused =
    !(await deps.requests.exists(targetId)) ||
    (await deps.requests.blocksBetween(userId, [targetId])).length > 0 ||
    !(await deps.requests.allowsOutside(workspaceId)) ||
    !(await deps.requests.reachableFromOutside(targetId)) ||
    (await deps.requests.coolingDown(userId, targetId, deps.now()));
  if (refused) throw notFound();
}

/** A direct chat with someone outside the workspace, or anyone from Personal: a request (AC-F14-10, 24). */
export async function startExternalDirect(deps: RequestsDeps, membership: Membership, targetId: string) {
  const { userId, workspaceId } = membership;
  await assertReachable(deps, membership, targetId);
  const rows = await deps.requests.directsByKey(directKeyOf(userId, targetId), userId);
  const existing = rows.find(
    (row) => row.conversation.workspaceId === workspaceId || (membership.kind === "personal" && row.member.external),
  );
  if (existing) return reopen(deps, existing.conversation, userId, targetId);
  await takeRequest(deps, userId);
  const made = await deps.chats.direct(workspaceId, userId, [
    { userId, external: false, state: "accepted" },
    { userId: targetId, external: true, state: "pending" },
  ]);
  return { id: made.conversation.id, created: made.created };
}

/** Requests waiting for this person, with up to 10 messages to preview (AC-F14-10). */
async function waitingFor(deps: RequestsDeps, userId: string) {
  const rows = await deps.requests.pendingFor(userId, requestCutoff(deps.now()));
  const messages = await deps.requests.previews(
    rows.map((row) => ({
      conversationId: row.conversation.id,
      historyFrom: row.member.historyFrom ?? row.conversation.createdAt,
    })),
  );
  return {
    requests: rows.map(({ conversation, member, from }) => ({
      conversationId: conversation.id,
      kind: conversation.kind as Exclude<ConversationKind, "meeting">,
      from: { userId: from.userId, name: from.name, email: from.email, photoUrl: photoOf(from) },
      groupName: conversation.name,
      requestedAt: (member.requestedAt ?? conversation.createdAt).toISOString(),
      preview: messages
        .filter((message) => message.conversationId === conversation.id)
        .slice(-PREVIEW_MESSAGES)
        .map((message) => ({
          senderName: message.senderName,
          text: (message.plainText ?? KIND_LINES[message.kind] ?? "").slice(0, 500),
          at: message.createdAt.toISOString(),
        })),
    })),
  };
}

/** The person's own unexpired request in this chat, if `action` is allowed on it. */
async function ownRequest(deps: RequestsDeps, userId: string, conversationId: string, action: ChatsAction) {
  const row = await deps.chats.member(conversationId, userId);
  if (!row || row.conversation.kind === "meeting") throw notFound();
  const facts = {
    kind: row.conversation.kind,
    state: row.member.state,
    outOfWorkspace: false,
    external: row.member.external,
    otherExternal: false,
    blocked: false,
    outsideOffWithExternal: false,
  };
  const expired = (row.member.requestedAt ?? new Date(0)) <= requestCutoff(deps.now());
  if (!canChats(action, facts) || expired) throw notFound();
  return row;
}

async function accept(deps: RequestsDeps, userId: string, conversationId: string) {
  await ownRequest(deps, userId, conversationId, "accept");
  await deps.requests.setState(conversationId, userId, { state: "accepted", joinedAt: deps.now() });
}

/** Only people outside every team workspace you're in can be blocked (AC-F14-13, as in Teams). */
async function blockPerson(deps: RequestsDeps, userId: string, targetId: string) {
  const colleague = (await deps.requests.sharedTeamWorkspaces(userId, targetId)) > 0;
  if (targetId === userId || colleague || !(await deps.requests.exists(targetId))) {
    throw new AppError(400, "CHAT_INVALID", "This person can't be blocked.");
  }
  await deps.requests.block(userId, targetId);
}

/** Delete: gone for the receiver, unchanged for the sender, no new request for 30 days (AC-F14-11). */
async function decline(deps: RequestsDeps, userId: string, conversationId: string, block: boolean) {
  const row = await ownRequest(deps, userId, conversationId, "decline");
  const sender = row.member.addedBy;
  if (block && sender) await blockPerson(deps, userId, sender);
  await deps.requests.setState(conversationId, userId, { state: "declined" });
  if (row.conversation.kind === "group") {
    const me = (await deps.chats.peopleOf([conversationId])).find((p) => p.userId === userId);
    await saveNote(deps.chat, row.conversation, { id: userId, name: me?.name ?? "" }, { event: "didnt_join" });
  }
  if (row.conversation.kind === "direct" && sender) {
    await deps.requests.coolDown(sender, userId, new Date(deps.now().getTime() + REQUEST_DAYS * DAY_MS));
  }
}

export function createChatsRequestsService(deps: RequestsDeps) {
  return {
    waitingFor: (userId: string) => waitingFor(deps, userId),
    accept: (userId: string, conversationId: string) => accept(deps, userId, conversationId),
    decline: (userId: string, conversationId: string, block: boolean) => decline(deps, userId, conversationId, block),
    block: (userId: string, targetId: string) => blockPerson(deps, userId, targetId),
    unblock: async (userId: string, targetId: string) => {
      await deps.requests.unblock(userId, targetId);
    },
    blocked: async (userId: string) => ({
      people: (await deps.requests.blockedBy(userId)).map((p) => ({
        userId: p.userId,
        name: p.name,
        photoUrl: photoOf(p),
      })),
    }),
  };
}

export type ChatsRequestsService = ReturnType<typeof createChatsRequestsService>;
