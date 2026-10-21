// Chat requests and blocking (F14 design.md 3.7; AC-F14-10–13, 24): a chat with someone outside the
// workspace waits for them, as in Teams. Times are moved in the database instead of waiting 30 days.
import { randomUUID } from "node:crypto";
import { chatBlocks, chatMessages, chatRequestCooldowns, conversationMembers } from "@meetapp/db";
import { and, eq } from "drizzle-orm";
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

interface Item {
  id: string;
  title: string;
  readOnly: boolean;
  request: string | null;
}
interface Requests {
  requests: {
    conversationId: string;
    from: { userId: string; name: string; email: string };
    preview: { text: string }[];
  }[];
}

const start = (person: Person, workspaceId: string, userId: string) =>
  call(person.token, "POST", `/api/v1/workspaces/${workspaceId}/conversations`, { userIds: [userId] });
const started = async (person: Person, workspaceId: string, userId: string) =>
  (await start(person, workspaceId, userId)).json<{ id: string }>().id;
const listOf = async (person: Person, workspaceId: string) =>
  (await call(person.token, "GET", `/api/v1/workspaces/${workspaceId}/conversations`)).json<{
    conversations: Item[];
  }>().conversations;
const requestsOf = async (person: Person) =>
  (await call(person.token, "GET", "/api/v1/me/chat-requests")).json<Requests>().requests;
const accept = (person: Person, id: string) => call(person.token, "POST", `/api/v1/conversations/${id}/accept`);
const decline = (person: Person, id: string, block = false) =>
  call(person.token, "POST", `/api/v1/conversations/${id}/decline`, { block });

async function stateOf(conversationId: string, userId: string) {
  const [row] = await t.database.db
    .select()
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
  return row;
}

/** Moves a request (or a 30-day wait) back in time. */
async function ageRequest(conversationId: string, userId: string, days: number) {
  await t.database.db
    .update(conversationMembers)
    .set({ requestedAt: new Date(Date.now() - days * DAY_MS) })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
}

async function message(conversationId: string, workspaceId: string, from: Person, text: string) {
  await t.database.db.insert(chatMessages).values({
    workspaceId,
    conversationId,
    senderUserId: from.id,
    senderName: "Sender",
    senderGroup: "member",
    kind: "text",
    plainText: text,
    body: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text }] }] },
    clientId: randomUUID(),
  });
}

/** M1 in team W1, and E1 outside it with a Personal workspace. */
async function pair(label: string) {
  const m1 = await namedPerson(t, `${label}-m1`, "Maya Member");
  const e1 = await namedPerson(t, `${label}-e1`, "Eli External");
  const w1 = await seedWorkspace(t, [[m1, "owner"]]);
  const personal = await seedPersonal(t, e1);
  return { m1, e1, w1, personal };
}

describe("chat requests", { timeout: 60_000 }, () => {
  it("TC-F14-16 [AC-F14-10] a chat with someone outside is a request they can preview; the sender waits", async () => {
    const { m1, e1, w1, personal } = await pair("r16");
    const id = await started(m1, w1, e1.id);
    await message(id, w1, m1, "Hello from outside");

    expect(await stateOf(id, m1.id)).toMatchObject({ state: "accepted", external: false });
    expect(await stateOf(id, e1.id)).toMatchObject({ state: "pending", external: true });
    const [request] = await requestsOf(e1);
    expect(request).toMatchObject({
      conversationId: id,
      from: { userId: m1.id, name: "Maya Member", email: m1.email },
      preview: [{ text: "Hello from outside" }],
    });
    expect((await listOf(m1, w1)).find((c) => c.id === id)).toMatchObject({
      title: "Eli External",
      request: "waiting",
    });
    // Until accepted it shows under Chat requests only, not in E1's list.
    expect((await listOf(e1, personal)).map((c) => c.id)).not.toContain(id);
    // Starting again opens the same chat.
    expect(await started(m1, w1, e1.id)).toBe(id);
  });

  it("TC-F14-18 [AC-F14-11] accept makes it a normal chat; nobody else can accept", async () => {
    const { m1, e1, personal, w1 } = await pair("r18");
    const id = await started(m1, w1, e1.id);
    const stranger = await newPerson(t, "r18-x");
    expect((await accept(stranger, id)).statusCode).toBe(404);
    expect((await accept(m1, id)).statusCode).toBe(404);

    expect((await accept(e1, id)).statusCode).toBe(204);
    expect(await stateOf(id, e1.id)).toMatchObject({ state: "accepted" });
    expect(await requestsOf(e1)).toEqual([]);
    expect((await listOf(e1, personal)).find((c) => c.id === id)).toMatchObject({
      title: "Maya Member",
      readOnly: false,
    });
    expect((await listOf(m1, w1)).find((c) => c.id === id)?.request).toBeNull();
  });

  it("TC-F14-19 [AC-F14-11] delete: gone for the receiver, unchanged for the sender, 30 days before asking again", async () => {
    const { m1, e1, w1 } = await pair("r19");
    const id = await started(m1, w1, e1.id);
    expect((await decline(e1, id)).statusCode).toBe(204);
    expect(await requestsOf(e1)).toEqual([]);
    expect((await listOf(m1, w1)).find((c) => c.id === id)?.request).toBe("waiting");

    const cooldown = eq(chatRequestCooldowns.fromUser, m1.id);
    await t.database.db
      .update(chatRequestCooldowns)
      .set({ until: new Date(Date.now() + DAY_MS) })
      .where(cooldown);
    expect((await start(m1, w1, e1.id)).statusCode).toBe(404); // day 29
    await t.database.db
      .update(chatRequestCooldowns)
      .set({ until: new Date(Date.now() - DAY_MS) })
      .where(cooldown);
    expect(await started(m1, w1, e1.id)).toBe(id); // day 31: asked again in the same chat
    expect(await stateOf(id, e1.id)).toMatchObject({ state: "pending" });
  });

  it("TC-F14-20 [AC-F14-11, AC-F14-13] delete with Block: the sender can't start again and isn't told", async () => {
    const { m1, e1, w1 } = await pair("r20");
    const id = await started(m1, w1, e1.id);
    expect((await decline(e1, id, true)).statusCode).toBe(204);
    const blocks = await t.database.db.select().from(chatBlocks).where(eq(chatBlocks.blockerId, e1.id));
    expect(blocks.map((b) => b.blockedId)).toEqual([m1.id]);
    expect(await stateOf(id, e1.id)).toMatchObject({ state: "declined" });
    expect((await listOf(m1, w1)).find((c) => c.id === id)?.request).toBe("waiting");
  });

  it("TC-F14-22 [AC-F14-12] 20 new requests a day; colleagues don't count", async () => {
    const m1 = await newPerson(t, "r22-m1");
    const colleague = await newPerson(t, "r22-m2");
    const w1 = await seedWorkspace(t, [
      [m1, "owner"],
      [colleague, "member"],
    ]);
    const outsiders = await Promise.all(Array.from({ length: 21 }, (_, i) => newPerson(t, `r22-e${String(i)}`)));
    for (const outsider of outsiders.slice(0, 20)) expect((await start(m1, w1, outsider.id)).statusCode).toBe(200);
    const refused = await start(m1, w1, outsiders[20]?.id ?? "");
    expect(refused.statusCode).toBe(429);
    expect((await start(m1, w1, colleague.id)).statusCode).toBe(200);
  });

  it("TC-F14-23 [AC-F14-12] after 30 days the request is hidden when read; the sender sees 'didn't accept'", async () => {
    const { m1, e1, w1 } = await pair("r23");
    const id = await started(m1, w1, e1.id);
    await ageRequest(id, e1.id, 29);
    expect((await requestsOf(e1)).map((r) => r.conversationId)).toEqual([id]);
    await ageRequest(id, e1.id, 31);
    expect(await requestsOf(e1)).toEqual([]);
    expect((await accept(e1, id)).statusCode).toBe(404);
    expect((await listOf(m1, w1)).find((c) => c.id === id)?.request).toBe("not_accepted");

    await t.accounts.chatUpkeep.cleanUp();
    expect(await stateOf(id, e1.id)).toMatchObject({ state: "declined" });
    expect((await listOf(m1, w1)).find((c) => c.id === id)?.request).toBe("not_accepted");
  });

  it("TC-F14-24 [AC-F14-10, AC-F14-01] in Personal everyone is external; Personal keeps one member", async () => {
    const y1 = await namedPerson(t, "r24-y1", "Yara Personal");
    const x1 = await namedPerson(t, "r24-x1", "Xavi Personal");
    const yp = await seedPersonal(t, y1);
    const xp = await seedPersonal(t, x1);
    const id = await started(y1, yp, x1.id);
    expect(await stateOf(id, x1.id)).toMatchObject({ state: "pending", external: true });
    expect((await accept(x1, id)).statusCode).toBe(204);
    expect((await listOf(x1, xp)).find((c) => c.id === id)?.title).toBe("Yara Personal");
    expect((await listOf(y1, yp)).find((c) => c.id === id)?.title).toBe("Xavi Personal");
    const members = await call(y1.token, "GET", `/api/v1/workspaces/${yp}/members`);
    expect(members.json<{ members: unknown[] }>().members).toHaveLength(1);
  });
});

describe("blocking", { timeout: 60_000 }, () => {
  it("TC-F14-25 [AC-F14-13] after a block the chat is read-only for both and a new start is refused", async () => {
    const { m1, e1, w1, personal } = await pair("b25");
    const id = await started(m1, w1, e1.id);
    await accept(e1, id);
    expect((await call(e1.token, "POST", "/api/v1/me/blocked", { userId: m1.id })).statusCode).toBe(204);

    expect((await listOf(m1, w1)).find((c) => c.id === id)?.readOnly).toBe(true);
    expect((await listOf(e1, personal)).find((c) => c.id === id)?.readOnly).toBe(true);
    // Refused like a chat that doesn't exist: no hint of the block.
    expect((await start(m1, w1, e1.id)).statusCode).toBe(404);
    const fromPersonal = await seedPersonal(t, m1);
    expect((await start(m1, fromPersonal, e1.id)).statusCode).toBe(404);
  });

  it("TC-F14-26 [AC-F14-13] colleagues can't be blocked; an external person can", async () => {
    const m1 = await newPerson(t, "b26-m1");
    const m2 = await newPerson(t, "b26-m2");
    const e1 = await newPerson(t, "b26-e1");
    await seedWorkspace(t, [
      [m1, "owner"],
      [m2, "member"],
    ]);
    const refused = await call(m1.token, "POST", "/api/v1/me/blocked", { userId: m2.id });
    expect(refused.statusCode).toBe(400);
    expect(errorCode(refused)).toBe("CHAT_INVALID");
    expect((await call(m1.token, "POST", "/api/v1/me/blocked", { userId: e1.id })).statusCode).toBe(204);
    const rows = await t.database.db.select().from(chatBlocks).where(eq(chatBlocks.blockerId, m1.id));
    expect(rows.map((r) => r.blockedId)).toEqual([e1.id]);
  });

  it("TC-F14-28 [AC-F14-13] Blocked people lists and unblocks; a new request works again", async () => {
    const { m1, e1, w1 } = await pair("b28");
    expect((await call(e1.token, "POST", "/api/v1/me/blocked", { userId: m1.id })).statusCode).toBe(204);
    const before = await call(e1.token, "GET", "/api/v1/me/blocked");
    expect(before.json<{ people: { userId: string; name: string }[] }>().people).toEqual([
      { userId: m1.id, name: "Maya Member", photoUrl: null },
    ]);
    expect((await start(m1, w1, e1.id)).statusCode).toBe(404);

    expect((await call(e1.token, "DELETE", `/api/v1/me/blocked/${m1.id}`)).statusCode).toBe(204);
    expect((await call(e1.token, "GET", "/api/v1/me/blocked")).json<{ people: unknown[] }>().people).toEqual([]);
    expect((await start(m1, w1, e1.id)).statusCode).toBe(200);
  });
});
