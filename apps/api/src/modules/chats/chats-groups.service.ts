// Group chats (F14 design.md 3.6; AC-F14-14–18), as in Teams: any member renames, adds (choosing how
// much history the new people see) or removes anyone, the creator included. People from outside get a
// request. Removed and left people keep reading what they saw. When the last member leaves, the group
// is marked and the clean-up deletes it with its messages and files within 30 days.
import { CHATS_LIMITS } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import { saveNote } from "./chats-notes.ts";
import { canChats, type ChatsAction } from "./chats.permissions.ts";
import { assertReachable, type RequestsDeps } from "./chats-requests.service.ts";
import type { ChatsGroupsRepository } from "./chats-groups.repository.ts";

export interface GroupsDeps extends RequestsDeps {
  groups: ChatsGroupsRepository;
}

type History = { from: "none" } | { from: "all" } | { from: "days"; days: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");
export const groupFull = () =>
  new AppError(409, "CHAT_GROUP_FULL", `A group chat can have up to ${String(CHATS_LIMITS.groupMax)} people.`);

/** The person's group chat, if `action` is allowed for them (anyone else: 404). */
async function groupFor(deps: GroupsDeps, userId: string, conversationId: string, action: ChatsAction) {
  const row = await deps.chats.member(conversationId, userId);
  if (!row || row.conversation.kind !== "group" || row.conversation.deletedAt) throw notFound();
  const facts = {
    kind: "group" as const,
    state: row.member.state,
    outOfWorkspace: false,
    external: row.member.external,
    otherExternal: false,
    blocked: false,
    outsideOffWithExternal: false,
  };
  if (!canChats(action, facts)) throw notFound();
  const people = await deps.chats.peopleOf([conversationId]);
  const me = { id: userId, name: people.find((p) => p.userId === userId)?.name ?? "" };
  return { conversation: row.conversation, people, me };
}

async function rename(deps: GroupsDeps, userId: string, conversationId: string, name: string) {
  const { conversation, me } = await groupFor(deps, userId, conversationId, "rename");
  await deps.groups.rename(conversationId, name);
  await saveNote(deps.chat, conversation, me, { event: "named", groupName: name });
}

function historyStart(history: History, createdAt: Date, now: Date) {
  if (history.from === "none") return now;
  if (history.from === "all") return createdAt;
  return new Date(now.getTime() - history.days * DAY_MS);
}

/** Add people (AC-F14-14, 15, 17): colleagues join at once, people from outside get a request. */
async function addPeople(deps: GroupsDeps, userId: string, conversationId: string, body: AddBody) {
  const { conversation, people, me } = await groupFor(deps, userId, conversationId, "addPeople");
  const place = {
    userId,
    workspaceId: conversation.workspaceId,
    kind: await deps.groups.workspaceKind(conversation.workspaceId),
  };
  const inside = new Set(people.filter((p) => p.state === "accepted" || p.state === "pending").map((p) => p.userId));
  const added = [...new Set(body.userIds)].filter((id) => !inside.has(id));
  if (added.length === 0) return;
  if ((await deps.groups.size(conversationId)) + added.length > CHATS_LIMITS.groupMax) throw groupFull();
  const members = new Set(await deps.chats.workspaceMemberIds(conversation.workspaceId, added));
  const external = (id: string) => place.kind === "personal" || !members.has(id);
  for (const id of added.filter(external)) await assertReachable(deps, place, id);
  const historyFrom = historyStart(body.history, conversation.createdAt, deps.now());
  await deps.groups.add(
    conversation,
    added.map((userId) => ({ userId, external: external(userId), historyFrom })),
    me.id,
  );
  const names = (await deps.chats.peopleOf([conversationId])).filter((p) => added.includes(p.userId));
  await saveNote(deps.chat, conversation, me, { event: "added", names: names.map((p) => p.name) });
}

interface AddBody {
  userIds: string[];
  history: History;
}

/** Any member removes anyone, the creator included (AC-F14-18, as in Teams group chats). */
async function remove(deps: GroupsDeps, userId: string, conversationId: string, targetId: string) {
  const { conversation, people, me } = await groupFor(deps, userId, conversationId, "removePeople");
  const target = people.find((p) => p.userId === targetId && (p.state === "accepted" || p.state === "pending"));
  if (!target || targetId === userId) throw notFound();
  // They read up to and including the note that says they were removed.
  await saveNote(deps.chat, conversation, me, { event: "removed", names: [target.name] });
  await deps.groups.stop(conversationId, targetId, "removed", await deps.chat.lastSeq(conversationId));
}

async function leave(deps: GroupsDeps, userId: string, conversationId: string) {
  const { conversation, me } = await groupFor(deps, userId, conversationId, "leave");
  await saveNote(deps.chat, conversation, me, { event: "left" });
  // They read up to and including their own "left" note.
  await deps.groups.stop(conversationId, userId, "left", await deps.chat.lastSeq(conversationId));
  if ((await deps.groups.accepted(conversationId)) === 0) await deps.groups.markDeleted(conversationId);
}

export function createChatsGroupsService(deps: GroupsDeps) {
  return {
    rename: (userId: string, conversationId: string, name: string) => rename(deps, userId, conversationId, name),
    addPeople: (userId: string, conversationId: string, body: AddBody) => addPeople(deps, userId, conversationId, body),
    remove: (userId: string, conversationId: string, targetId: string) =>
      remove(deps, userId, conversationId, targetId),
    leave: (userId: string, conversationId: string) => leave(deps, userId, conversationId),
  };
}

export type ChatsGroupsService = ReturnType<typeof createChatsGroupsService>;
