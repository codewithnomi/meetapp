// The chat list and starting chats (F14 design.md 3.1, 3.5; AC-F14-01–05, 07, 09, 15, 28, 35): one list
// for one-to-one, group and meeting chats, newest activity first with pinned chats on top, unread counts,
// filters and name search. A chat with someone outside the workspace is a request (chats-requests.service.ts).
import { CHATS_LIMITS, type ConversationListItem, type ReadOnlyReason, type Status } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import type { Membership } from "../workspaces/workspaces.permissions.ts";
import { matchesNames } from "./chats.search.ts";
import { readOnlyReason } from "./chats-readonly.ts";
import type { ChatsRepository, Conversation, ConversationMember } from "./chats.repository.ts";
import { groupFull } from "./chats-groups.service.ts";
import { assertReachable, requestCutoff, startExternalDirect, type RequestsDeps } from "./chats-requests.service.ts";

interface ReadableMeeting {
  id: string;
  workspaceId: string;
  title: string;
}

export interface ChatsDeps extends RequestsDeps {
  chats: ChatsRepository;
  /** Statuses `viewer` may see (AC-F14-26). */
  statuses: (viewer: string, userIds: string[]) => Promise<Map<string, Status>>;
  /** Meetings whose chat the person may read now (F03's rules, AC-F14-28). */
  readableMeetings: (userId: string) => Promise<ReadableMeeting[]>;
}

/** The person's own choices for a chat; a field left out stays as it is. */
interface MyChoice {
  pinned?: boolean | undefined;
  muted?: boolean | undefined;
  hidden?: boolean | undefined;
}

const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");
const invalid = () => new AppError(400, "CHAT_INVALID", "This chat can't be started.");
const DELETED_LINE = "This message was deleted";
const KIND_LINES: Record<string, string> = { gif: "GIF", sticker: "Sticker", poll: "Poll" };
const SHOWN_NAMES = 3;

type Person = Awaited<ReturnType<ChatsRepository["peopleOf"]>>[number];
type Last = Awaited<ReturnType<ChatsRepository["lastMessages"]>>[number];
interface Entry {
  conversation: Conversation;
  member?: ConversationMember;
  meetingTitle?: string;
}

const photoOf = (person: Person) =>
  person.avatarKey ? `/api/v1/users/${person.userId}/avatar?v=${person.avatarKey}` : null;

function titleOf(entry: Entry, others: Person[]): string {
  if (entry.meetingTitle !== undefined) return entry.meetingTitle;
  if (entry.conversation.kind === "group" && entry.conversation.name) return entry.conversation.name;
  const names = others.map((person) => person.name);
  const rest = names.length - SHOWN_NAMES;
  return names.slice(0, SHOWN_NAMES).join(", ") + (rest > 0 ? ` +${String(rest)}` : "");
}

function lastLine(last: Last | undefined, userId: string): ConversationListItem["lastMessage"] {
  if (!last) return null;
  const text = last.deletedAt ? DELETED_LINE : (last.plainText?.split("\n")[0] ?? KIND_LINES[last.kind] ?? "");
  return {
    senderName: last.senderName,
    own: last.senderUserId === userId,
    firstLine: text.slice(0, 200),
    at: last.createdAt.toISOString(),
  };
}

interface Built {
  item: ConversationListItem;
  names: string[];
  pinnedAt: Date | null;
  activity: number;
}

/** The starter's view of an unanswered request in a direct chat (AC-F14-10, 11, 12). */
function requestOf(entry: Entry, others: Person[], now: Date): ConversationListItem["request"] {
  const [other] = others;
  if (entry.conversation.kind !== "direct" || !other) return null;
  if (other.state !== "pending" && other.state !== "declined") return null;
  return (other.requestedAt ?? now) <= requestCutoff(now) ? "not_accepted" : "waiting";
}

/** Who shows in a chat's title: accepted members; in a direct chat also the person asked. */
const shownIn = (entry: Entry, person: Person) =>
  person.state === "accepted" || (entry.conversation.kind === "direct" && person.state !== "left");

/** For one-to-one chats: who is blocked either way, and the statuses the person may see. */
async function directFacts(deps: ChatsDeps, userId: string, entries: Entry[], people: Person[]) {
  const directIds = new Set(entries.filter((e) => e.conversation.kind === "direct").map((e) => e.conversation.id));
  const others = people.filter((p) => p.userId !== userId && directIds.has(p.conversationId)).map((p) => p.userId);
  const blocks = await deps.requests.blocksBetween(userId, others);
  const blocked = new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]));
  const workspaces = [...new Set(entries.map((e) => e.conversation.workspaceId))];
  const allowed = await Promise.all(workspaces.map(async (id) => [id, await deps.requests.allowsOutside(id)] as const));
  return { blocked, statuses: await deps.statuses(userId, others), outsideAllowed: new Map(allowed) };
}

type ListFacts = Awaited<ReturnType<typeof directFacts>>;

/** The note a read-only chat shows (AC-F14-13, 18, 27, 34); meeting chats follow F03's rules. */
function reasonFor(entry: Entry, userId: string, people: Person[], facts: ListFacts): ReadOnlyReason | null {
  if (!entry.member) return null;
  if (entry.member.state !== "accepted") return "left";
  const mine = people.filter((p) => p.conversationId === entry.conversation.id);
  return readOnlyReason({
    kind: entry.conversation.kind,
    userId,
    people: mine,
    blocked: mine.some((p) => p.userId !== userId && facts.blocked.has(p.userId)),
    outsideAllowed: facts.outsideAllowed.get(entry.conversation.workspaceId) ?? true,
  });
}

/** The list shows only what the person may read: no older history, nothing after leaving (AC-F14-18). */
function readWindow(entry: Entry) {
  const ended = entry.member !== undefined && entry.member.state !== "accepted";
  return {
    conversationId: entry.conversation.id,
    from: entry.member?.historyFrom ?? null,
    until: ended ? (entry.member?.leftAt ?? null) : null,
  };
}

async function build(deps: ChatsDeps, userId: string, entries: Entry[]): Promise<Built[]> {
  const ids = entries.map((entry) => entry.conversation.id);
  const windows = entries.map(readWindow);
  const [people, lasts, unread] = await Promise.all([
    deps.chats.peopleOf(ids),
    deps.chats.lastMessages(windows),
    deps.chats.unreadCounts(userId, windows),
  ]);
  const facts = await directFacts(deps, userId, entries, people);
  const { statuses } = facts;
  const now = deps.now();
  return entries.map((entry) => {
    const id = entry.conversation.id;
    const others = people.filter((p) => p.conversationId === id && p.userId !== userId && shownIn(entry, p));
    const last = lasts.find((row) => row.conversationId === id);
    const item: ConversationListItem = {
      id,
      kind: entry.conversation.kind,
      meetingId: entry.conversation.meetingId,
      title: titleOf(entry, others),
      people: others
        .slice(0, SHOWN_NAMES)
        .map((p) => ({ userId: p.userId, name: p.name, photoUrl: photoOf(p), external: p.external })),
      status: entry.conversation.kind === "direct" ? (statuses.get(others[0]?.userId ?? "") ?? null) : null,
      lastMessage: lastLine(last, userId),
      unread: unread.find((row) => row.conversationId === id)?.unread ?? 0,
      mentioned: unread.find((row) => row.conversationId === id)?.mentioned ?? false,
      pinned: Boolean(entry.member?.pinnedAt),
      muted: entry.member?.muted ?? false,
      readOnly: reasonFor(entry, userId, people, facts) !== null,
      readOnlyReason: reasonFor(entry, userId, people, facts),
      request: requestOf(entry, others, now),
    };
    const activity = (last?.createdAt ?? entry.conversation.createdAt).getTime();
    return {
      item,
      names: [item.title, ...others.map((p) => p.name)],
      pinnedAt: entry.member?.pinnedAt ?? null,
      activity,
    };
  });
}

const byListOrder = (a: Built, b: Built) => {
  if (a.pinnedAt && b.pinnedAt) return a.pinnedAt.getTime() - b.pinnedAt.getTime();
  if (a.pinnedAt || b.pinnedAt) return a.pinnedAt ? -1 : 1;
  return b.activity - a.activity;
};

const FILTERS = {
  all: () => true,
  unread: (b: Built) => b.item.unread > 0,
  chats: (b: Built) => b.item.kind !== "meeting",
  meetings: (b: Built) => b.item.kind === "meeting",
};

async function list(
  deps: ChatsDeps,
  membership: Membership,
  query: { filter: keyof typeof FILTERS; q?: string | undefined },
) {
  const { userId, workspaceId } = membership;
  const rows = await deps.chats.listRows(userId, workspaceId, membership.kind === "personal");
  const meetings = (await deps.readableMeetings(userId)).filter((m) => m.workspaceId === workspaceId);
  const meetingConversations = await deps.chats.meetingConversations(meetings.map((m) => m.id));
  const entries: Entry[] = [
    ...rows,
    ...meetingConversations.map((conversation) => ({
      conversation,
      meetingTitle: meetings.find((m) => m.id === conversation.meetingId)?.title ?? "",
    })),
  ];
  const built = (await build(deps, userId, entries)).sort(byListOrder);
  const shown = built.filter(FILTERS[query.filter]).filter((b) => matchesNames(query.q ?? "", b.names));
  return {
    conversations: shown.map((b) => b.item),
    unreadChats: built.filter((b) => b.item.unread > 0).length,
  };
}

/** One person opens the pair's direct chat; two or more make a group (AC-F14-07, 09, 15). */
async function start(deps: ChatsDeps, membership: Membership, body: { userIds: string[]; name?: string | undefined }) {
  const { userId, workspaceId } = membership;
  const others = [...new Set(body.userIds)].filter((id) => id !== userId);
  if (others.length === 0) throw invalid();
  if (others.length + 1 > CHATS_LIMITS.groupMax) throw groupFull();
  const members = membership.kind === "personal" ? [] : await deps.chats.workspaceMemberIds(workspaceId, others);
  const accepted = (id: string) => ({ userId: id, external: false, state: "accepted" as const });
  const [first] = others;
  // Someone outside the workspace (everyone, from Personal) gets a chat request (AC-F14-10, 24).
  if (others.length === 1 && first && members.length === 0) return startExternalDirect(deps, membership, first);
  if (others.length === 1 && first) {
    const made = await deps.chats.direct(workspaceId, userId, [accepted(userId), accepted(first)]);
    if (made.created) await deps.live.list([userId, first], made.conversation.id, "added");
    return { id: made.conversation.id, created: made.created };
  }
  // A group: colleagues join at once, people from outside get a request (AC-F14-14, 15).
  const inside = new Set(members);
  const outside = others.filter((id) => !inside.has(id));
  for (const id of outside) await assertReachable(deps, membership, id);
  const group = await deps.chats.group({
    workspaceId,
    by: userId,
    name: body.name,
    members: [
      accepted(userId),
      ...members.map(accepted),
      ...outside.map((id) => ({ userId: id, external: true, state: "pending" as const })),
    ],
  });
  await deps.live.list([userId, ...others], group.id, "added");
  return { id: group.id, created: true };
}

/** The person's pin, mute and hide choices for a chat (AC-F14-05, 35). */
async function setMine(deps: ChatsDeps, userId: string, conversationId: string, choice: MyChoice) {
  const row = await deps.chats.member(conversationId, userId);
  if (!row) throw notFound();
  const change: { pinnedAt?: Date | null; muted?: boolean; hidden?: boolean } = {};
  if (choice.pinned !== undefined) {
    if (choice.pinned && !row.member.pinnedAt && (await deps.chats.pinnedCount(userId)) >= CHATS_LIMITS.pinnedChats) {
      throw new AppError(409, "CHAT_PIN_LIMIT", `You can pin up to ${String(CHATS_LIMITS.pinnedChats)} chats.`);
    }
    change.pinnedAt = choice.pinned ? (row.member.pinnedAt ?? new Date()) : null;
  }
  if (choice.muted !== undefined) change.muted = choice.muted;
  if (choice.hidden !== undefined) change.hidden = choice.hidden;
  await deps.chats.setMine(conversationId, userId, change);
}

/** "Seen" for the others, live: only when receipts apply (AC-F14-24); the line drops it for people
 * with receipts off. */
async function tellRead(deps: ChatsDeps, conversation: Conversation, userId: string, seq: number) {
  if (conversation.kind === "meeting" || !(await deps.chats.readReceipts(userId))) return;
  const members = (await deps.chats.peopleOf([conversation.id])).filter((p) => p.state === "accepted");
  if (conversation.kind === "group" && members.length > CHATS_LIMITS.seenGroupMax) return;
  await deps.live.read(conversation.id, userId, seq);
}

/** "Read up to here" for a chat the person is in, or a meeting chat they may read (AC-F14-02, 24). */
async function markRead(deps: ChatsDeps, userId: string, conversationId: string, seq: number) {
  const row = await deps.chats.member(conversationId, userId);
  if (row) {
    await deps.chats.markRead({ conversationId, workspaceId: row.conversation.workspaceId, userId, seq });
    await tellRead(deps, row.conversation, userId, seq);
    return;
  }
  const readable = await deps.readableMeetings(userId);
  const meetingChats = await deps.chats.meetingConversations(readable.map((m) => m.id));
  const meeting = meetingChats.find((c) => c.id === conversationId);
  if (!meeting) throw notFound();
  await deps.chats.markRead({ conversationId, workspaceId: meeting.workspaceId, userId, seq });
}

export function createChatsService(deps: ChatsDeps) {
  return {
    list: (membership: Membership, query: { filter: keyof typeof FILTERS; q?: string | undefined }) =>
      list(deps, membership, query),
    start: (membership: Membership, body: { userIds: string[]; name?: string | undefined }) =>
      start(deps, membership, body),
    setMine: (userId: string, conversationId: string, choice: MyChoice) =>
      setMine(deps, userId, conversationId, choice),
    markRead: (userId: string, conversationId: string, seq: number) => markRead(deps, userId, conversationId, seq),
  };
}

export type ChatsService = ReturnType<typeof createChatsService>;
