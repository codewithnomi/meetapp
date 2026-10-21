// The chat list and starting chats (F14 T4; design.md 3.1, 3.5, 5): real routes and database. Messages
// in one-to-one and group chats are written straight to the database here; sending arrives in T8.
import { randomUUID } from "node:crypto";
import type { ConversationKind } from "@meetapp/contracts";
import { chatMessages, conversations } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { joined, meetingWithTeam, withTicket } from "../../test-support/meetings-setup.ts";
import {
  caller,
  errorCode,
  newPerson,
  seedWorkspace,
  type Call,
  type Person,
} from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

interface Item {
  id: string;
  kind: ConversationKind;
  title: string;
  people: { name: string }[];
  lastMessage: { own: boolean; firstLine: string } | null;
  unread: number;
  pinned: boolean;
  muted: boolean;
}
interface List {
  conversations: Item[];
  unreadChats: number;
}

const listOf = async (person: Person, workspaceId: string, query = "") =>
  (await call(person.token, "GET", `/api/v1/workspaces/${workspaceId}/conversations${query}`)).json<List>();
const start = (person: Person, workspaceId: string, body: object) =>
  call(person.token, "POST", `/api/v1/workspaces/${workspaceId}/conversations`, body);
const started = async (person: Person, workspaceId: string, body: object) =>
  (await start(person, workspaceId, body)).json<{ id: string; created: boolean }>();

// Messages are stamped in the past, a second apart, so a read mark "now" covers them all.
let clock = Date.now() - 3_600_000;
/** A message in a chat, written as T8's sending will (a later time each call). */
async function say(conversationId: string, workspaceId: string, from: Person, text: string) {
  clock += 1000;
  const at = new Date(clock);
  await t.database.db.insert(chatMessages).values({
    workspaceId,
    conversationId,
    senderUserId: from.id,
    senderName: from.email,
    senderGroup: "member",
    kind: "text",
    plainText: text,
    body: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text }] }] },
    clientId: randomUUID(),
    createdAt: at,
  });
  await t.database.db.update(conversations).set({ lastMessageAt: at }).where(eq(conversations.id, conversationId));
}

async function team(label: string, size: number) {
  const people = await Promise.all(Array.from({ length: size }, (_, i) => newPerson(t, `${label}-${String(i)}`)));
  const workspaceId = await seedWorkspace(
    t,
    people.map((p, i) => [p, i === 0 ? "owner" : "member"]),
    label,
  );
  return { people, workspaceId };
}

describe("starting chats", { timeout: 60_000 }, () => {
  it("TC-F14-12 [AC-F14-07] [AC-F14-09] one person opens the direct chat (the same one again); two or more make a group", async () => {
    const { people, workspaceId } = await team("start", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const first = await started(m1, workspaceId, { userIds: [m2.id] });
    const again = await started(m1, workspaceId, { userIds: [m2.id] });
    expect(again).toEqual({ id: first.id, created: false });
    const unnamed = await started(m1, workspaceId, { userIds: [m2.id, m3.id] });
    const named = await started(m1, workspaceId, { userIds: [m2.id, m3.id], name: "Launch" });
    expect(new Set([first.id, unnamed.id, named.id]).size).toBe(3);
    const list = await listOf(m1, workspaceId);
    expect(list.conversations.find((c) => c.id === named.id)?.title).toBe("Launch");
    expect(list.conversations.find((c) => c.id === unnamed.id)?.kind).toBe("group");
    // An account that doesn't exist, in a direct chat or a group, and empty starts are refused.
    expect((await start(m1, workspaceId, { userIds: [randomUUID()] })).statusCode).toBe(404);
    expect((await start(m1, workspaceId, { userIds: [randomUUID(), m2.id] })).statusCode).toBe(404);
    expect(errorCode(await start(m1, workspaceId, { userIds: [m1.id] }))).toBe("CHAT_INVALID");
  });

  it("TC-F14-15 [AC-F14-09] both people starting at the same moment get one direct chat; another workspace gets its own", async () => {
    const { people, workspaceId } = await team("race", 2);
    const [m1, m2] = people as [Person, Person];
    const answers = await Promise.all(
      Array.from({ length: 20 }, (_, i) => started(i % 2 ? m1 : m2, workspaceId, { userIds: [i % 2 ? m2.id : m1.id] })),
    );
    expect(new Set(answers.map((a) => a.id)).size).toBe(1);
    const other = await seedWorkspace(
      t,
      [
        [m1, "owner"],
        [m2, "member"],
      ],
      "race-2",
    );
    expect((await started(m1, other, { userIds: [m2.id] })).id).not.toBe(answers[0]?.id);
  });
});

describe("the chat list", { timeout: 60_000 }, () => {
  it("TC-F14-01 [AC-F14-01] only this workspace's chats, newest first, with names and the last line", async () => {
    const { people, workspaceId } = await team("list", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const direct = await started(m1, workspaceId, { userIds: [m2.id] });
    const group = await started(m1, workspaceId, { userIds: [m2.id, m3.id] });
    const named = await started(m1, workspaceId, { userIds: [m2.id, m3.id], name: "Launch" });
    await say(direct.id, workspaceId, m2, "first");
    await say(group.id, workspaceId, m1, "mine\nsecond line");
    await say(named.id, workspaceId, m3, "newest");
    const other = await seedWorkspace(
      t,
      [
        [m1, "owner"],
        [m2, "member"],
      ],
      "list-2",
    );
    const elsewhere = await started(m1, other, { userIds: [m2.id] });

    const list = await listOf(m1, workspaceId);
    expect(list.conversations.map((c) => c.id)).toEqual([named.id, group.id, direct.id]);
    const byId = new Map(list.conversations.map((c) => [c.id, c]));
    // A one-to-one chat is titled with the other person's name.
    const directItem = byId.get(direct.id);
    expect(directItem?.title).toBe(directItem?.people[0]?.name);
    expect(directItem?.title).not.toBe("");
    expect(byId.get(direct.id)?.people.map((p) => p.name)).toHaveLength(1);
    expect(byId.get(group.id)?.lastMessage).toMatchObject({ own: true, firstLine: "mine" });
    expect(byId.get(group.id)?.people).toHaveLength(2);
    expect(byId.has(elsewhere.id)).toBe(false);
    expect((await listOf(m1, other)).conversations.map((c) => c.id)).toEqual([elsewhere.id]);
    // Someone who isn't in the workspace gets 404.
    const outsider = await newPerson(t, "list-outsider");
    expect((await call(outsider.token, "GET", `/api/v1/workspaces/${workspaceId}/conversations`)).statusCode).toBe(404);
  });

  it("TC-F14-03 [AC-F14-02] unread counts others' messages after the read mark; the total counts chats", async () => {
    const { people, workspaceId } = await team("unread", 4);
    const [m1, m2, m3, m4] = people as [Person, Person, Person, Person];
    const a = await started(m1, workspaceId, { userIds: [m2.id] });
    const b = await started(m1, workspaceId, { userIds: [m3.id] });
    const c = await started(m1, workspaceId, { userIds: [m4.id] });
    await say(a.id, workspaceId, m2, "one");
    await say(a.id, workspaceId, m2, "two");
    await say(a.id, workspaceId, m1, "my own never counts");
    await say(b.id, workspaceId, m3, "read soon");
    await call(m1.token, "PUT", `/api/v1/conversations/${b.id}/read`, { seq: 1 });
    for (let i = 0; i < 120; i++) await say(c.id, workspaceId, m4, `n${String(i)}`);

    let list = await listOf(m1, workspaceId);
    const count = (id: string) => list.conversations.find((x) => x.id === id)?.unread;
    expect([count(a.id), count(b.id), count(c.id)]).toEqual([2, 0, 120]);
    expect(list.unreadChats).toBe(2);
    expect((await call(m1.token, "PUT", `/api/v1/conversations/${a.id}/read`, { seq: 3 })).statusCode).toBe(204);
    list = await listOf(m1, workspaceId);
    expect(list.unreadChats).toBe(1);
    // A read mark on someone else's chat: 404.
    expect((await call(m2.token, "PUT", `/api/v1/conversations/${c.id}/read`, { seq: 1 })).statusCode).toBe(404);
  });

  it("TC-F14-05 TC-F14-57 [AC-F14-03] [AC-F14-28] filters, and meeting chats only for people who took part", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "filters", 2);
    const [taken, absent] = members as [Person, Person];
    const host = await joined(t, meeting, organizer);
    await joined(t, meeting, taken);
    await withTicket(t, host.ticket, { method: "POST", url: `/api/v1/calls/${host.call?.callId ?? ""}/end` });
    const direct = await started(organizer, meeting.workspaceId, { userIds: [taken.id] });
    await say(direct.id, meeting.workspaceId, taken, "unread one");
    const group = await started(organizer, meeting.workspaceId, { userIds: [taken.id, absent.id] });

    const ids = async (person: Person, filter: string) =>
      (await listOf(person, meeting.workspaceId, `?filter=${filter}`)).conversations.map((c) => c.kind + ":" + c.id);
    const all = await ids(organizer, "all");
    expect(all).toHaveLength(3);
    expect(all.some((x) => x.startsWith("meeting:"))).toBe(true);
    expect(await ids(organizer, "unread")).toEqual([`direct:${direct.id}`]);
    expect((await ids(organizer, "chats")).sort()).toEqual([`direct:${direct.id}`, `group:${group.id}`].sort());
    expect((await ids(organizer, "meetings")).every((x) => x.startsWith("meeting:"))).toBe(true);
    // The person who never joined doesn't see the meeting's chat.
    expect((await ids(absent, "meetings")).length).toBe(0);
    expect((await ids(taken, "meetings")).length).toBe(1);
  });

  it("TC-F14-07 [AC-F14-04] search matches names, ignoring case and accents, never message text", async () => {
    const { people, workspaceId } = await team("search", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const direct = await started(m1, workspaceId, { userIds: [m2.id] });
    await say(direct.id, workspaceId, m2, "budget numbers");
    const cafe = await started(m1, workspaceId, { userIds: [m2.id, m3.id], name: "Café team" });
    expect((await listOf(m1, workspaceId, "?q=budget")).conversations).toEqual([]);
    expect((await listOf(m1, workspaceId, "?q=CAFE")).conversations.map((c) => c.id)).toEqual([cafe.id]);
  });

  it("TC-F14-08 [AC-F14-05] up to 15 pinned chats first in the order pinned; the 16th is refused", async () => {
    const { people, workspaceId } = await team("pins", 17);
    const [m1, ...others] = people as [Person, ...Person[]];
    const chats = [];
    for (const other of others) chats.push((await started(m1, workspaceId, { userIds: [other.id] })).id);
    const pin = (id: string, pinned: boolean) => call(m1.token, "PATCH", `/api/v1/conversations/${id}/me`, { pinned });
    for (const id of chats.slice(0, 15)) expect((await pin(id, true)).statusCode).toBe(204);
    expect(errorCode(await pin(chats[15] ?? "", true))).toBe("CHAT_PIN_LIMIT");
    await pin(chats[0] ?? "", false);
    await pin(chats[15] ?? "", true);
    const list = await listOf(m1, workspaceId);
    const pinned = list.conversations.filter((c) => c.pinned).map((c) => c.id);
    expect(pinned).toEqual([...chats.slice(1, 15), chats[15]]);
    expect(list.conversations[15]?.pinned).toBe(false);
  });

  it("TC-F14-09 TC-F14-72 [AC-F14-05] [AC-F14-35] muted chats still count unread; a hidden chat leaves only my list", async () => {
    const { people, workspaceId } = await team("mute", 2);
    const [m1, m2] = people as [Person, Person];
    const chat = await started(m1, workspaceId, { userIds: [m2.id] });
    await call(m1.token, "PATCH", `/api/v1/conversations/${chat.id}/me`, { muted: true });
    await say(chat.id, workspaceId, m2, "still counts");
    const item = (await listOf(m1, workspaceId)).conversations[0];
    expect(item).toMatchObject({ muted: true, unread: 1 });
    await call(m1.token, "PATCH", `/api/v1/conversations/${chat.id}/me`, { hidden: true });
    expect((await listOf(m1, workspaceId)).conversations).toEqual([]);
    expect((await listOf(m2, workspaceId)).conversations.map((c) => c.id)).toEqual([chat.id]);
  });
});
