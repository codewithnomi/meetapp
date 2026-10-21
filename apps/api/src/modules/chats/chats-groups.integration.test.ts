// Group chats (F14 design.md 3.6; AC-F14-14–18), as in Teams: any member renames, adds with a history
// choice, removes anyone; people from outside get a request; the last one out deletes the group.
import { randomUUID } from "node:crypto";
import { chatMessages, conversationMembers, conversations, user, workspaceMembers } from "@meetapp/db";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import {
  caller,
  errorCode,
  namedPerson,
  newPerson,
  seedPersonal,
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

const DAY_MS = 24 * 60 * 60 * 1000;

const startGroup = (person: Person, workspaceId: string, userIds: string[], name?: string) =>
  call(person.token, "POST", `/api/v1/workspaces/${workspaceId}/conversations`, { userIds, ...(name ? { name } : {}) });
const groupOf = async (person: Person, workspaceId: string, others: Person[]) =>
  (
    await startGroup(
      person,
      workspaceId,
      others.map((p) => p.id),
    )
  ).json<{ id: string }>().id;
const add = (person: Person, id: string, body: object) =>
  call(person.token, "POST", `/api/v1/conversations/${id}/members`, body);

const memberRow = async (conversationId: string, userId: string) =>
  (
    await t.database.db
      .select()
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)))
  )[0];
const notes = async (conversationId: string) =>
  (
    await t.database.db
      .select({ system: chatMessages.system })
      .from(chatMessages)
      .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.kind, "system")))
      .orderBy(asc(chatMessages.createdAt))
  ).map((row) => row.system);

async function message(conversationId: string, workspaceId: string, from: Person, daysAgo: number) {
  await t.database.db.insert(chatMessages).values({
    workspaceId,
    conversationId,
    senderUserId: from.id,
    senderName: "Sender",
    senderGroup: "member",
    kind: "text",
    plainText: `${String(daysAgo)} days ago`,
    body: { v: 1, blocks: [] },
    clientId: randomUUID(),
    createdAt: new Date(Date.now() - daysAgo * DAY_MS),
  });
}

async function trio(label: string) {
  const people = await Promise.all(["One", "Two", "Three"].map((n) => namedPerson(t, `${label}-${n}`, `Member ${n}`)));
  const [m1, m2, m3] = people as [Person, Person, Person];
  const w1 = await seedWorkspace(t, [
    [m1, "owner"],
    [m2, "member"],
    [m3, "member"],
  ]);
  return { m1, m2, m3, w1, id: await groupOf(m1, w1, [m2, m3]) };
}

describe("group chats", { timeout: 120_000 }, () => {
  it("TC-F14-29 TC-F14-30 [AC-F14-14] someone from outside gets a request with only later messages; Delete means they didn't join", async () => {
    const { m1, w1, id } = await trio("g29");
    const e1 = await namedPerson(t, "g29-e1", "Outside Person");
    await seedPersonal(t, e1);
    for (let i = 0; i < 5; i += 1) await message(id, w1, m1, 1);
    expect((await add(m1, id, { userIds: [e1.id] })).statusCode).toBe(204);
    expect(await memberRow(id, e1.id)).toMatchObject({ state: "pending", external: true });
    for (let i = 0; i < 2; i += 1) await message(id, w1, m1, 0);

    const requests = (await call(e1.token, "GET", "/api/v1/me/chat-requests")).json<{
      requests: { conversationId: string; kind: string; preview: unknown[] }[];
    }>().requests;
    expect(requests).toEqual([expect.objectContaining({ conversationId: id, kind: "group" })]);
    // Only the 2 messages after the add (the "added" note is a system note, not previewed).
    expect(requests[0]?.preview).toHaveLength(2);

    expect((await call(e1.token, "POST", `/api/v1/conversations/${id}/decline`, { block: false })).statusCode).toBe(
      204,
    );
    expect(await memberRow(id, e1.id)).toMatchObject({ state: "declined" });
    expect(await notes(id)).toEqual([
      expect.objectContaining({ event: "added", name: "Member One", names: ["Outside Person"] }),
      expect.objectContaining({ event: "didnt_join", name: "Outside Person" }),
    ]);
    // The group still works for its members.
    expect((await call(m1.token, "PATCH", `/api/v1/conversations/${id}`, { name: "Still here" })).statusCode).toBe(204);
  });

  it("TC-F14-31 [AC-F14-15] 3 to 250 people; 251 and adding to a full group are refused; 2 make a direct chat", async () => {
    const m1 = await newPerson(t, "g31-m1");
    const ids = Array.from({ length: 250 }, () => randomUUID());
    await t.database.db
      .insert(user)
      .values(ids.map((id) => ({ id, name: "Seeded Person", email: `g31-${id}@example.test`, emailVerified: true })));
    const w1 = await seedWorkspace(t, [[m1, "owner"]]);
    await t.database.db
      .insert(workspaceMembers)
      .values(ids.map((userId) => ({ workspaceId: w1, userId, role: "member" as const })));

    const kindOf = async (answer: { json: <T>() => T }) => {
      const id = answer.json<{ id: string }>().id;
      return (await t.database.db.select().from(conversations).where(eq(conversations.id, id)))[0]?.kind;
    };
    expect(await kindOf(await startGroup(m1, w1, ids.slice(0, 1)))).toBe("direct");
    expect(await kindOf(await startGroup(m1, w1, ids.slice(0, 2)))).toBe("group");
    const full = await startGroup(m1, w1, ids.slice(0, 249));
    expect(full.statusCode).toBe(200);
    const tooBig = await startGroup(m1, w1, ids.slice(0, 250));
    expect(tooBig.statusCode).toBe(409);
    expect(errorCode(tooBig)).toBe("CHAT_GROUP_FULL");
    const fullId = full.json<{ id: string }>().id;
    const refused = await add(m1, fullId, { userIds: [ids[249]] });
    expect(refused.statusCode).toBe(409);
    expect(errorCode(refused)).toBe("CHAT_GROUP_FULL");
    expect(refused.json<{ error: { message: string } }>().error.message).toContain("250");
  });

  it("TC-F14-32 [AC-F14-16] any member renames (1–80 characters) and a note is saved", async () => {
    const { m2, id } = await trio("g32");
    const rename = (name: string) => call(m2.token, "PATCH", `/api/v1/conversations/${id}`, { name });
    expect((await rename("A")).statusCode).toBe(204);
    expect((await rename("x".repeat(80))).statusCode).toBe(204);
    expect((await rename("  ")).statusCode).toBe(400);
    expect((await rename("x".repeat(81))).statusCode).toBe(400);
    expect((await rename("<b>Design</b>")).statusCode).toBe(204);
    const [row] = await t.database.db.select().from(conversations).where(eq(conversations.id, id));
    expect(row?.name).toBe("<b>Design</b>"); // stored as text; the app shows it as text
    expect((await notes(id)).at(-1)).toMatchObject({ event: "named", name: "Member Two", groupName: "<b>Design</b>" });
    const stranger = await newPerson(t, "g32-x");
    expect((await call(stranger.token, "PATCH", `/api/v1/conversations/${id}`, { name: "No" })).statusCode).toBe(404);
  });

  it("TC-F14-33 [AC-F14-17] new people see no history, the last N days, or all (the default)", async () => {
    const { m1, w1, id } = await trio("g33");
    const newcomers = await Promise.all(["n1", "n2", "n3", "n4"].map((l) => newPerson(t, `g33-${l}`)));
    await t.database.db
      .insert(workspaceMembers)
      .values(newcomers.map((p) => ({ workspaceId: w1, userId: p.id, role: "member" as const })));
    const [n1, n2, n3, n4] = newcomers as [Person, Person, Person, Person];
    await t.database.db
      .update(conversations)
      .set({ createdAt: new Date(Date.now() - 500 * DAY_MS) })
      .where(eq(conversations.id, id));

    const before = Date.now();
    expect((await add(m1, id, { userIds: [n1.id], history: { from: "none" } })).statusCode).toBe(204);
    expect((await add(m1, id, { userIds: [n2.id], history: { from: "days", days: 30 } })).statusCode).toBe(204);
    expect((await add(m1, id, { userIds: [n3.id] })).statusCode).toBe(204);
    expect((await add(m1, id, { userIds: [n4.id], history: { from: "days", days: 0 } })).statusCode).toBe(400);
    expect((await add(m1, id, { userIds: [n4.id], history: { from: "days", days: 366 } })).statusCode).toBe(400);

    expect((await memberRow(id, n1.id))?.historyFrom?.getTime()).toBeGreaterThanOrEqual(before - 1000);
    const thirty = (await memberRow(id, n2.id))?.historyFrom?.getTime() ?? 0;
    expect(Math.abs(thirty - (before - 30 * DAY_MS))).toBeLessThan(60_000);
    expect((await memberRow(id, n3.id))?.historyFrom?.getTime()).toBeLessThan(before - 400 * DAY_MS);
    expect((await memberRow(id, n3.id))?.state).toBe("accepted");
    expect((await notes(id)).filter((n) => (n as { event: string }).event === "added")).toHaveLength(3);
  });

  it("TC-F14-34 TC-F14-35 [AC-F14-18] any member removes anyone; leaving keeps what was seen; the last one out deletes it", async () => {
    const { m1, m2, m3, w1, id } = await trio("g35");
    await message(id, w1, m1, 0);
    // M2 removes the creator.
    expect((await call(m2.token, "DELETE", `/api/v1/conversations/${id}/members/${m1.id}`)).statusCode).toBe(204);
    const removed = await memberRow(id, m1.id);
    expect(removed).toMatchObject({ state: "removed" });
    expect(removed?.leftSeq).toBeGreaterThan(0);
    // The removed person can't act any more.
    expect((await call(m1.token, "PATCH", `/api/v1/conversations/${id}`, { name: "No" })).statusCode).toBe(404);

    expect((await call(m3.token, "POST", `/api/v1/conversations/${id}/leave`)).statusCode).toBe(204);
    const [still] = await t.database.db.select().from(conversations).where(eq(conversations.id, id));
    expect(still).toMatchObject({ kind: "group", deletedAt: null }); // one member left: still a group
    expect((await memberRow(id, m3.id))?.leftSeq).toBeGreaterThan(removed?.leftSeq ?? 0);

    expect((await call(m2.token, "POST", `/api/v1/conversations/${id}/leave`)).statusCode).toBe(204);
    const [marked] = await t.database.db.select().from(conversations).where(eq(conversations.id, id));
    expect(marked?.deletedAt).not.toBeNull();
    expect((await notes(id)).map((n) => (n as { event: string }).event)).toEqual(["removed", "left", "left"]);

    // Day 31: the clean-up deletes the group and its messages.
    await t.database.db
      .update(conversations)
      .set({ deletedAt: new Date(Date.now() - 31 * DAY_MS) })
      .where(eq(conversations.id, id));
    await t.accounts.chatUpkeep.cleanUp();
    expect(await t.database.db.select().from(conversations).where(eq(conversations.id, id))).toEqual([]);
    expect(await t.database.db.select().from(chatMessages).where(eq(chatMessages.conversationId, id))).toEqual([]);
  });
});
