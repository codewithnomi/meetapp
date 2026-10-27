// Messages in one-to-one and group chats (F14 design.md 3.2, 3.3; AC-F14-12, 13, 18, 19, 21, 22, 24):
// F03's message rules per conversation, edit and delete any time, mentions, the 10 messages while a
// request waits, read-only blocked chats, what left people may read, and "who has seen".
import { randomUUID } from "node:crypto";
import { chatBlocks, chatEvents, chatMessages, conversationMembers, conversationReads } from "@meetapp/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import {
  caller,
  errorCode,
  namedPerson,
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

interface View {
  id: string;
  body: { blocks: { content?: { type: string; userId?: string }[] }[] } | null;
  editedAt: string | null;
  deletedAt: string | null;
  replyTo: { id: string } | null;
  reactions: { emoji: string; count: number; userIds: string[]; mine: boolean }[];
}

const text = (words: string) => ({ v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: words }] }] });
const send = (person: Person, id: string, body: object = text("hello"), extra: object = {}) =>
  call(person.token, "POST", `/api/v1/conversations/${id}/messages`, { clientId: randomUUID(), body, ...extra });
const sent = async (person: Person, id: string, words = "hello") => (await send(person, id, text(words))).json<View>();
const page = async (person: Person, id: string) =>
  (await call(person.token, "GET", `/api/v1/conversations/${id}/messages?limit=50`)).json<{ messages: View[] }>();
type Method = "GET" | "PATCH" | "DELETE";
const message = (person: Person, at: { id: string; messageId: string }, method: Method, body?: object) =>
  call(person.token, method, `/api/v1/conversations/${at.id}/messages/${at.messageId}`, body);
const start = async (person: Person, workspaceId: string, others: Person[]) =>
  (
    await call(person.token, "POST", `/api/v1/workspaces/${workspaceId}/conversations`, {
      userIds: others.map((p) => p.id),
    })
  ).json<{ id: string }>().id;

async function team(label: string, size: number) {
  const people = await Promise.all(
    Array.from({ length: size }, (_, i) => namedPerson(t, `${label}-${String(i)}`, `Person ${String(i + 1)}`)),
  );
  const workspaceId = await seedWorkspace(
    t,
    people.map((p, i) => [p, i === 0 ? "owner" : "member"]),
  );
  return { people, workspaceId };
}

describe("messages in chats", { timeout: 60_000 }, () => {
  it("TC-F14-36 [AC-F14-19, AC-F14-21] send, reply, react (one per person), limits; outsiders get 404", async () => {
    const { people, workspaceId } = await team("m36", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await start(m1, workspaceId, [m2, m3]);
    const first = await sent(m1, id, "first");
    const reply = (await send(m2, id, text("answer"), { replyToId: first.id })).json<View>();
    expect(reply.replyTo?.id).toBe(first.id);

    const react = (person: Person, emoji: string) =>
      call(person.token, "POST", `/api/v1/conversations/${id}/messages/${first.id}/reactions`, { emoji });
    expect((await react(m2, "👍")).statusCode).toBe(204);
    expect((await react(m2, "❤️")).statusCode).toBe(204); // replaces the 👍
    expect((await react(m3, "❤️")).statusCode).toBe(204);
    const seenByM2 = (await message(m2, { id, messageId: first.id }, "GET")).json<View>();
    expect(seenByM2.reactions).toEqual([expect.objectContaining({ emoji: "❤️", count: 2, mine: true })]);
    expect(seenByM2.reactions[0]?.userIds.sort()).toEqual([m2.id, m3.id].sort());

    expect((await send(m1, id, text("x".repeat(4001)))).statusCode).toBe(400);
    const outsider = await namedPerson(t, "m36-x", "Outsider");
    expect((await send(outsider, id)).statusCode).toBe(404);
    expect((await call(outsider.token, "GET", `/api/v1/conversations/${id}/messages?limit=5`)).statusCode).toBe(404);
    const messages = (await page(m3, id)).messages;
    expect(messages.map((m) => m.id)).toEqual([reply.id, first.id]);
    // The same client id twice is one message.
    const clientId = randomUUID();
    const once = await call(m3.token, "POST", `/api/v1/conversations/${id}/messages`, { clientId, body: text("once") });
    const twice = await call(m3.token, "POST", `/api/v1/conversations/${id}/messages`, {
      clientId,
      body: text("once"),
    });
    expect(twice.json<View>().id).toBe(once.json<View>().id);
  });

  it("TC-F14-36 [AC-F14-19] 10 messages in 10 seconds per person", async () => {
    const { people, workspaceId } = await team("m36r", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await start(m1, workspaceId, [m2]);
    for (let i = 0; i < 10; i += 1) expect((await send(m1, id)).statusCode).toBe(200);
    const fast = await send(m1, id);
    expect(fast.statusCode).toBe(429);
    expect(errorCode(fast)).toBe("CHAT_TOO_FAST");
  });

  it("TC-F14-39 [AC-F14-21] the sender edits and deletes a 2-day-old message; others can't", async () => {
    const { people, workspaceId } = await team("m39", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await start(m1, workspaceId, [m2]);
    const old = await sent(m1, id, "old words");
    await t.database.db
      .update(chatMessages)
      .set({ createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })
      .where(eq(chatMessages.id, old.id));
    // The chat itself is older still: its members read from its start.
    await t.database.db
      .update(conversationMembers)
      .set({ historyFrom: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) })
      .where(eq(conversationMembers.conversationId, id));
    expect((await message(m2, { id, messageId: old.id }, "PATCH", { body: text("not mine") })).statusCode).toBe(404);
    expect((await message(m2, { id, messageId: old.id }, "DELETE")).statusCode).toBe(404);
    const edited = await message(m1, { id, messageId: old.id }, "PATCH", { body: text("new words") });
    expect(edited.statusCode).toBe(200);
    expect(edited.json<View>().editedAt).not.toBeNull();
    expect((await message(m1, { id, messageId: old.id }, "DELETE")).statusCode).toBe(204);
    const gone = (await message(m2, { id, messageId: old.id }, "GET")).json<View>();
    expect(gone.deletedAt).not.toBeNull();
    expect(gone.body).toBeNull();
  });

  it("TC-F14-45 [AC-F14-22] a member's mention is kept and flags the chat even when muted; anyone else's is plain text", async () => {
    const { people, workspaceId } = await team("m45", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await start(m1, workspaceId, [m2, m3]);
    await call(m2.token, "PATCH", `/api/v1/conversations/${id}/me`, { muted: true });
    const stranger = await namedPerson(t, "m45-e", "Stranger");
    const body = {
      v: 1,
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "mention", userId: m2.id, text: "@Person 2" },
            { type: "text", text: " and " },
            { type: "mention", userId: stranger.id, text: "@Stranger" },
          ],
        },
      ],
    };
    const view = (await send(m1, id, body)).json<View>();
    const parts = view.body?.blocks[0]?.content ?? [];
    expect(parts.map((p) => p.type)).toEqual(["mention", "text", "text"]);
    expect(parts[0]?.userId).toBe(m2.id);
    const list = (await call(m2.token, "GET", `/api/v1/workspaces/${workspaceId}/conversations`)).json<{
      conversations: { id: string; unread: number; mentioned: boolean; muted: boolean }[];
    }>();
    expect(list.conversations.find((c) => c.id === id)).toMatchObject({ unread: 1, mentioned: true, muted: true });
    const m3List = (await call(m3.token, "GET", `/api/v1/workspaces/${workspaceId}/conversations`)).json<{
      conversations: { id: string; mentioned: boolean }[];
    }>();
    expect(m3List.conversations.find((c) => c.id === id)?.mentioned).toBe(false);
  });
});

describe("read marks and edited mentions", { timeout: 60_000 }, () => {
  const unreadOf = async (person: Person, workspaceId: string, id: string) =>
    (await call(person.token, "GET", `/api/v1/workspaces/${workspaceId}/conversations`))
      .json<{ conversations: { id: string; unread: number }[] }>()
      .conversations.find((c) => c.id === id)?.unread;
  const newest = async (id: string) =>
    (await t.database.db.select({ seq: chatEvents.seq }).from(chatEvents).where(eq(chatEvents.conversationId, id)))
      .map((row) => row.seq)
      .reduce((a, b) => Math.max(a, b), 0);
  const readTo = (person: Person, id: string, seq: number) =>
    call(person.token, "PUT", `/api/v1/conversations/${id}/read`, { seq });

  it("TC-F14-03 [AC-F14-02] unread follows the news number: a message after the number seen stays unread", async () => {
    const { people, workspaceId } = await team("r03", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await start(m1, workspaceId, [m2]);
    await sent(m2, id, "one");
    const firstSeq = await newest(id);
    await sent(m2, id, "two");
    // M1's app saw only the first message's news when it marked read.
    expect((await readTo(m1, id, firstSeq)).statusCode).toBe(204);
    expect(await unreadOf(m1, workspaceId, id)).toBe(1);
    // A number past the newest is clamped to it; marks never move back.
    expect((await readTo(m1, id, 1000)).statusCode).toBe(204);
    expect(await unreadOf(m1, workspaceId, id)).toBe(0);
    const [mark] = await t.database.db
      .select({ seq: conversationReads.lastReadSeq })
      .from(conversationReads)
      .where(and(eq(conversationReads.conversationId, id), eq(conversationReads.userId, m1.id)));
    expect(mark?.seq).toBe(await newest(id));
    await readTo(m1, id, firstSeq);
    expect(await unreadOf(m1, workspaceId, id)).toBe(0);
  });

  it("TC-F14-41 [AC-F14-20] the daily clean-up keeps each chat's newest news, so numbers continue", async () => {
    const { people, workspaceId } = await team("r41", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await start(m1, workspaceId, [m2]);
    for (const words of ["a", "b", "c"]) await sent(m1, id, words);
    await t.database.db.execute(
      sql`update chat_events set created_at = now() - interval '2 days' where conversation_id = ${id}`,
    );
    await t.accounts.chatUpkeep.cleanUp();
    const seqs = async () =>
      (
        await t.database.db
          .select({ seq: chatEvents.seq })
          .from(chatEvents)
          .where(eq(chatEvents.conversationId, id))
          .orderBy(chatEvents.seq)
      ).map((row) => row.seq);
    const last = await newest(id);
    expect(await seqs()).toEqual([last]);
    await sent(m1, id, "d");
    expect(await seqs()).toEqual([last, last + 1]);
  });

  it("TC-F14-45 [AC-F14-22] editing cleans mentions like sending: a non-member becomes text, a new member mention counts", async () => {
    const { people, workspaceId } = await team("e45", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await start(m1, workspaceId, [m2, m3]);
    const stranger = await namedPerson(t, "e45-x", "Stranger");
    const first = await sent(m1, id, "hello");
    const edited = {
      v: 1,
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "mention", userId: m3.id, text: "@Person 3" },
            { type: "mention", userId: stranger.id, text: "@Stranger" },
          ],
        },
      ],
    };
    const view = (await message(m1, { id, messageId: first.id }, "PATCH", { body: edited })).json<View>();
    expect(view.body?.blocks[0]?.content?.map((p) => p.type)).toEqual(["mention", "text"]);
    const [row] = await t.database.db.select().from(chatMessages).where(eq(chatMessages.id, first.id));
    expect(row?.mentionedUserIds).toEqual([m3.id]);
  });
});

describe("opening and paging", { timeout: 120_000 }, () => {
  type Paged = { messages: (View & { cursor: string })[]; hasMore: boolean };
  const pageOf = async (person: Person, id: string, before?: string) =>
    (
      await call(
        person.token,
        "GET",
        `/api/v1/conversations/${id}/messages?limit=50${before ? `&before=${encodeURIComponent(before)}` : ""}`,
      )
    ).json<Paged>();
  async function allPages(person: Person, id: string) {
    const ids: string[] = [];
    let before: string | undefined;
    for (;;) {
      const got = await pageOf(person, id, before);
      ids.push(...got.messages.map((m) => m.id));
      if (!got.hasMore) return ids;
      before = got.messages.at(-1)?.cursor;
    }
  }

  it("TC-F14-59 [AC-F14-29] the newest first, then 50 at a time with no gaps or repeats; history limits hold", async () => {
    const { people, workspaceId } = await team("p59", 4);
    const [m1, m2, m3, m4] = people as [Person, Person, Person, Person];
    const id = await start(m1, workspaceId, [m2, m4]);
    const DAY_MS = 24 * 60 * 60 * 1000;
    // 120 messages, the first 60 written 40 days ago.
    const rows = Array.from({ length: 120 }, (_, i) => ({
      workspaceId,
      conversationId: id,
      senderUserId: m2.id,
      senderName: "Person 2",
      senderGroup: "member" as const,
      kind: "text" as const,
      plainText: `n${String(i)}`,
      body: text(`n${String(i)}`),
      clientId: randomUUID(),
      createdAt: new Date(Date.now() - (i < 60 ? 40 * DAY_MS : 0) - (120 - i) * 1000),
    }));
    await t.database.db.insert(chatMessages).values(rows);
    await t.database.db
      .update(conversationMembers)
      .set({ historyFrom: new Date(Date.now() - 50 * DAY_MS) })
      .where(eq(conversationMembers.conversationId, id));

    const began = Date.now();
    const first = await pageOf(m1, id);
    expect(Date.now() - began).toBeLessThan(1000);
    expect(first.messages).toHaveLength(50);
    const ids = await allPages(m1, id);
    expect(ids).toHaveLength(120);
    expect(new Set(ids).size).toBe(120);
    const all = await t.database.db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, id))
      .orderBy(desc(chatMessages.createdAt));
    expect(ids).toEqual(all.map((row) => row.id));

    // M3 joins seeing only the last 30 days: older pages never come.
    const added = await call(m1.token, "POST", `/api/v1/conversations/${id}/members`, {
      userIds: [m3.id],
      history: { from: "days", days: 30 },
    });
    expect(added.statusCode).toBe(204);
    const theirs = await allPages(m3, id);
    // The 60 recent messages and the "added" note; nothing from 40 days ago.
    const recent = await t.database.db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(and(eq(chatMessages.conversationId, id), sql`${chatMessages.createdAt} > now() - interval '30 days'`))
      .orderBy(desc(chatMessages.createdAt));
    expect(recent).toHaveLength(61);
    expect(theirs).toEqual(recent.map((row) => row.id));
  });
});

describe("requests, blocks and leaving", { timeout: 60_000 }, () => {
  async function request(label: string) {
    const m1 = await namedPerson(t, `${label}-m1`, "Maya Member");
    const e1 = await namedPerson(t, `${label}-e1`, "Eli External");
    const w1 = await seedWorkspace(t, [[m1, "owner"]]);
    await seedPersonal(t, e1);
    return { m1, e1, w1, id: await start(m1, w1, [e1]) };
  }

  it("TC-F14-21 [AC-F14-12] 10 messages while the request waits; more after Accept", async () => {
    const { m1, e1, id } = await request("q21");
    for (let i = 0; i < 10; i += 1) expect((await send(m1, id)).statusCode).toBe(200);
    const eleventh = await send(m1, id);
    expect(eleventh.statusCode).toBe(403);
    expect(errorCode(eleventh)).toBe("CHAT_REQUEST_LIMIT");
    expect(eleventh.json<{ error: { message: string } }>().error.message).toBe(
      "You can send more once Eli External accepts.",
    );
    // The receiver can't write before accepting.
    expect((await send(e1, id)).statusCode).toBe(404);
    await call(e1.token, "POST", `/api/v1/conversations/${id}/accept`);
    expect((await send(e1, id)).statusCode).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 10_500)); // M1's 10-in-10-seconds window
    expect((await send(m1, id)).statusCode).toBe(200);
  });

  it("TC-F14-25 [AC-F14-13] a blocked one-to-one chat is read-only for both, and still readable", async () => {
    const { m1, e1, id } = await request("q25");
    await call(e1.token, "POST", `/api/v1/conversations/${id}/accept`);
    const before = await sent(m1, id, "before the block");
    await call(e1.token, "POST", "/api/v1/me/blocked", { userId: m1.id });
    for (const person of [m1, e1]) {
      const refused = await send(person, id);
      expect(refused.statusCode).toBe(403);
      expect(errorCode(refused)).toBe("CHAT_READ_ONLY");
    }
    expect((await page(m1, id)).messages.map((m) => m.id)).toEqual([before.id]);
  });

  it("TC-F14-27 [AC-F14-13] in a group, a blocker and the blocked still see each other's messages", async () => {
    const { people, workspaceId } = await team("q27", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await start(m1, workspaceId, [m2, m3]);
    await t.database.db.insert(chatBlocks).values({ blockerId: m2.id, blockedId: m3.id });
    const fromM2 = await sent(m2, id, "from the blocker");
    const fromM3 = await sent(m3, id, "from the blocked");
    expect((await page(m2, id)).messages.map((m) => m.id)).toContain(fromM3.id);
    expect((await page(m3, id)).messages.map((m) => m.id)).toContain(fromM2.id);
  });

  it("TC-F14-34 [AC-F14-18] left and removed people read only what they saw and can't send", async () => {
    const { people, workspaceId } = await team("q34", 4);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await start(m1, workspaceId, people.slice(1));
    const early = await sent(m1, id, "early");
    expect((await call(m1.token, "DELETE", `/api/v1/conversations/${id}/members/${m3.id}`)).statusCode).toBe(204);
    expect((await call(m2.token, "POST", `/api/v1/conversations/${id}/leave`)).statusCode).toBe(204);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const later = await sent(m1, id, "later");
    for (const person of [m2, m3]) {
      const ids = (await page(person, id)).messages.map((m) => m.id);
      expect(ids).toContain(early.id);
      expect(ids).not.toContain(later.id);
      expect((await message(person, { id, messageId: later.id }, "GET")).statusCode).toBe(404);
      expect((await send(person, id)).statusCode).toBe(404);
    }
    const events = (await call(m3.token, "GET", `/api/v1/conversations/${id}/events?after=0`)).json<{
      events: { seq: number }[];
    }>();
    const [row] = await t.database.db
      .select()
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, id), eq(conversationMembers.userId, m3.id)));
    expect(events.events.every((e) => e.seq <= (row?.leftSeq ?? 0))).toBe(true);
  });
});

describe("Seen", { timeout: 60_000 }, () => {
  it("TC-F14-49 [AC-F14-24] who has seen lists readers with receipts on; a group of 21 has no list", async () => {
    const { people, workspaceId } = await team("s49", 5);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await start(m1, workspaceId, people.slice(1));
    const mine = await sent(m1, id, "did you see this");
    expect((await call(m2.token, "PATCH", "/api/v1/me/settings", { readReceipts: false })).statusCode).toBe(204);
    const read = (person: Person) => call(person.token, "PUT", `/api/v1/conversations/${id}/read`, { seq: 1000 });
    await read(m3);
    await read(m2);
    const seen = async (person: Person, conversationId = id, messageId = mine.id) =>
      (await call(person.token, "GET", `/api/v1/conversations/${conversationId}/messages/${messageId}/seen`)).json<{
        people: { userId: string }[] | null;
      }>().people;
    expect((await seen(m1))?.map((p) => p.userId)).toEqual([m3.id]);
    // Receipts off: M2 sees no one's.
    const theirs = await sent(m3, id, "and this");
    await read(m1);
    expect(await seen(m2, id, theirs.id)).toBeNull();

    const big = await team("s49b", 21);
    const [b1] = big.people as [Person];
    const bigId = await start(b1, big.workspaceId, big.people.slice(1));
    const bigMessage = await sent(b1, bigId, "to many");
    expect(await seen(b1, bigId, bigMessage.id)).toBeNull();
  });
});

describe("group details and my settings", { timeout: 60_000 }, () => {
  it("TC-F14-79 [AC-F14-14, AC-F14-24] members list the chat's people; my settings show read receipts", async () => {
    const { people, workspaceId } = await team("g14", 3);
    const [m1] = people as [Person, Person, Person];
    const id = await start(m1, workspaceId, people.slice(1));
    const listed = (await call(m1.token, "GET", `/api/v1/conversations/${id}/members`)).json<{
      people: { name: string; pending: boolean; external: boolean }[];
    }>().people;
    expect(listed.map((p) => p.name).sort()).toEqual(["Person 1", "Person 2", "Person 3"]);
    expect(listed.every((p) => !p.pending && !p.external)).toBe(true);
    const outsider = await namedPerson(t, "g14-x", "Outsider");
    expect((await call(outsider.token, "GET", `/api/v1/conversations/${id}/members`)).statusCode).toBe(404);
    expect((await call(m1.token, "GET", "/api/v1/me/settings")).json()).toEqual({
      readReceipts: true,
      ringtone: 1,
      ringVolume: 70,
    });
    await call(m1.token, "PATCH", "/api/v1/me/settings", { readReceipts: false });
    expect((await call(m1.token, "GET", "/api/v1/me/settings")).json()).toEqual({
      readReceipts: false,
      ringtone: 1,
      ringVolume: 70,
    });
  });
});
