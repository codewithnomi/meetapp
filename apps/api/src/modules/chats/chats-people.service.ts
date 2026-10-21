// Finding people for New chat and inviting people without MeetApp (F14 design.md 2.2, 5; AC-F14-07, 08;
// D063). Names match the open workspace's members only. An exact email finds that one account anywhere
// (30 lookups a minute per person; logged as the searcher and a count, never the email). People without
// an account can be invited: F01's invitation in a team workspace, a "Join me on MeetApp" email in
// Personal (20 a day per person).
import { z } from "zod";
import type { Outbox } from "../../emails/outbox.ts";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";
import type { Membership } from "../workspaces/workspaces.permissions.ts";
import { matchesNames } from "./chats.search.ts";
import type { ChatsRepository } from "./chats.repository.ts";

export interface PeopleDeps {
  chats: ChatsRepository;
  limiter: RateLimiter;
  outbox: Outbox;
  publicUrl: string;
}

const SUGGESTIONS = 10;
const isEmail = (text: string) => z.email().safeParse(text.trim()).success;
const tooMany = (wait: number) =>
  new AppError(429, "TOO_MANY_ATTEMPTS", "Too many lookups. Try again in a minute.", wait);
const photoOf = (person: { userId: string; avatarKey: string | null }) =>
  person.avatarKey ? `/api/v1/users/${person.userId}/avatar?v=${person.avatarKey}` : null;

async function byEmail(deps: PeopleDeps, membership: Membership, email: string) {
  const wait = await deps.limiter.take(RATE_RULES.chatEmailLookups, membership.userId);
  if (wait !== undefined) throw tooMany(wait);
  const found = await deps.chats.userByEmail(email.trim());
  if (!found) return { people: [], noAccount: true };
  if (found.userId === membership.userId) return { people: [], noAccount: false };
  const inWorkspace = await deps.chats.workspaceMemberIds(membership.workspaceId, [found.userId]);
  const external = membership.kind === "personal" || inWorkspace.length === 0;
  return {
    people: [{ userId: found.userId, name: found.name, photoUrl: photoOf(found), external, status: null }],
    noAccount: false,
  };
}

async function byName(deps: PeopleDeps, membership: Membership, query: string) {
  if (membership.kind === "personal" || query.trim() === "") return { people: [], noAccount: false };
  const members = await deps.chats.workspacePeople(membership.workspaceId);
  const people = members
    .filter((person) => person.userId !== membership.userId && matchesNames(query, [person.name]))
    .slice(0, SUGGESTIONS)
    .map((person) => ({
      userId: person.userId,
      name: person.name,
      photoUrl: photoOf(person),
      external: false,
      status: null,
    }));
  return { people, noAccount: false };
}

/** "Join me on MeetApp" from the Personal workspace (AC-F14-08); nothing is sent before this call. */
async function inviteToMeetApp(deps: PeopleDeps, inviter: { id: string; name: string }, email: string) {
  const wait = await deps.limiter.take(RATE_RULES.chatInvites, inviter.id);
  if (wait !== undefined) throw new AppError(429, "TOO_MANY_ATTEMPTS", "You can send 20 invitations a day.", wait);
  // Same answer whether or not the email has an account; an existing account simply gets the email too.
  await deps.outbox.enqueue({
    to: email,
    template: { kind: "joinMe", inviter: inviter.name, email, link: deps.publicUrl },
  });
}

export function createChatsPeopleService(deps: PeopleDeps) {
  return {
    find: (membership: Membership, query: string) =>
      isEmail(query) ? byEmail(deps, membership, query) : byName(deps, membership, query),
    inviteToMeetApp: (inviter: { id: string; name: string }, email: string) => inviteToMeetApp(deps, inviter, email),
  };
}

export type ChatsPeopleService = ReturnType<typeof createChatsPeopleService>;
