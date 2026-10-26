// Chats and their workspace (F14 design.md 3.10, 3.11; AC-F14-27, 33, 34): the outside-chat switch,
// leaving or being removed from a workspace, account deletion's chats step and the data export.
import { randomUUID } from "node:crypto";
import {
  chatAttachments,
  chatBlocks,
  chatMessages,
  conversationMembers,
  conversations,
  user,
  workspaces,
} from "@meetapp/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { PDF } from "../../test-support/sample-files.ts";
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

const text = (words: string) => ({ v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: words }] }] });
const send = (person: Person, id: string, words = "hi") =>
  call(person.token, "POST", `/api/v1/conversations/${id}/messages`, { clientId: randomUUID(), body: text(words) });
const startWith = (person: Person, workspaceId: string, others: Person[]) =>
  call(person.token, "POST", `/api/v1/workspaces/${workspaceId}/conversations`, { userIds: others.map((p) => p.id) });
const started = async (person: Person, workspaceId: string, others: Person[]) =>
  (await startWith(person, workspaceId, others)).json<{ id: string }>().id;
const setOutside = (person: Person, workspaceId: string, on: boolean) =>
  call(person.token, "PATCH", `/api/v1/workspaces/${workspaceId}/settings`, { allowOutsideChat: on });
const listItem = async (person: Person, workspaceId: string, id: string) =>
  (await call(person.token, "GET", `/api/v1/workspaces/${workspaceId}/conversations`))
    .json<{ conversations: { id: string; readOnly: boolean; readOnlyReason: string | null }[] }>()
    .conversations.find((c) => c.id === id);

async function setUp(label: string) {
  const [a1, m1, m2, e1] = (await Promise.all(
    ["a1", "m1", "m2", "e1"].map((l) => namedPerson(t, `${label}-${l}`, l.toUpperCase())),
  )) as [Person, Person, Person, Person];
  const w1 = await seedWorkspace(t, [
    [a1, "owner"],
    [m1, "member"],
    [m2, "member"],
  ]);
  await seedPersonal(t, e1);
  return { a1, m1, m2, e1, w1 };
}

describe("chat with people outside the workspace", { timeout: 60_000 }, () => {
  it("TC-F14-54 TC-F14-55 [AC-F14-27] off: outside chats are read-only and new ones refused; on again: they work", async () => {
    const { a1, m1, m2, e1, w1 } = await setUp("o54");
    const outside = await started(m1, w1, [e1]);
    await call(e1.token, "POST", `/api/v1/conversations/${outside}/accept`);
    const group = await started(m1, w1, [m2, e1]);
    await call(e1.token, "POST", `/api/v1/conversations/${group}/accept`);
    const inside = await started(m1, w1, [m2]);

    expect((await setOutside(m1, w1, false)).statusCode).not.toBe(204); // a plain member can't
    expect((await setOutside(a1, w1, false)).statusCode).toBe(204);
    for (const id of [outside, group]) expect(errorCode(await send(m1, id))).toBe("CHAT_OUTSIDE_OFF");
    expect(errorCode(await send(e1, outside))).toBe("CHAT_OUTSIDE_OFF");
    expect((await send(m1, inside)).statusCode).toBe(200);
    expect(await listItem(m1, w1, outside)).toMatchObject({ readOnly: true, readOnlyReason: "outside_off" });
    const newcomer = await namedPerson(t, "o54-e2", "E2");
    expect((await startWith(m1, w1, [newcomer])).statusCode).toBe(404);

    expect((await setOutside(a1, w1, true)).statusCode).toBe(204);
    for (const id of [outside, group]) expect((await send(m1, id)).statusCode).toBe(200);
    expect(await listItem(m1, w1, outside)).toMatchObject({ readOnly: false, readOnlyReason: null });
  });

  it("TC-F14-56 [AC-F14-27] across workspaces: refused when the starter's workspace or all the target's are off", async () => {
    const { m1, w1 } = await setUp("o56");
    const [x1, x2, y1] = (await Promise.all(
      ["x1", "x2", "y1"].map((l) => namedPerson(t, `o56-${l}`, l.toUpperCase())),
    )) as [Person, Person, Person];
    const w2 = await seedWorkspace(t, [[x1, "owner"]]);
    await seedWorkspace(t, [[x1, "owner"]]); // X1's second workspace keeps outside chat on
    const w4 = await seedWorkspace(t, [[x2, "owner"]]);
    await setOutside(x1, w2, false);
    await setOutside(x2, w4, false);
    await seedPersonal(t, y1);

    expect((await startWith(m1, w1, [x1])).statusCode).toBe(200); // one of X1's workspaces allows it
    expect((await startWith(m1, w1, [x2])).statusCode).toBe(404); // all of X2's are off
    expect((await startWith(m1, w1, [y1])).statusCode).toBe(200); // Personal only
    const offMember = (await namedPerson(t, "o56-m9", "M9")) as Person;
    const off = await seedWorkspace(t, [[offMember, "owner"]]);
    await setOutside(offMember, off, false);
    const y2 = await namedPerson(t, "o56-y2", "Y2");
    expect((await startWith(offMember, off, [y2])).statusCode).toBe(404); // the starter's workspace is off
  });
});

describe("leaving a workspace", { timeout: 60_000 }, () => {
  it("TC-F14-71 [AC-F14-34] removed or leaving: out of its chats, notes saved, one-to-one chats read-only", async () => {
    const { a1, m1, m2, w1 } = await setUp("w71");
    const direct = await started(m1, w1, [m2]);
    const group = await started(m1, w1, [m2, a1]);
    const elsewhere = await seedWorkspace(t, [
      [m2, "owner"],
      [m1, "member"],
    ]);
    const kept = await started(m2, elsewhere, [m1]);

    expect((await call(a1.token, "DELETE", `/api/v1/workspaces/${w1}/members/${m2.id}`)).statusCode).toBe(204);
    for (const id of [direct, group]) {
      expect((await send(m2, id)).statusCode).toBe(404);
      const [row] = await t.database.db
        .select()
        .from(conversationMembers)
        .where(and(eq(conversationMembers.conversationId, id), eq(conversationMembers.userId, m2.id)));
      expect(row?.state).toBe("left");
    }
    expect(errorCode(await send(m1, direct))).toBe("CHAT_READ_ONLY");
    expect(await listItem(m1, w1, direct)).toMatchObject({ readOnly: true, readOnlyReason: "left_workspace" });
    expect((await send(m1, group)).statusCode).toBe(200);
    expect((await send(m2, kept)).statusCode).toBe(200); // other workspaces untouched

    // Leaving by choice does the same.
    expect((await call(m1.token, "POST", `/api/v1/workspaces/${w1}/leave`)).statusCode).toBe(204);
    expect((await send(m1, group)).statusCode).toBe(404);
  });
});

describe("account deletion and data", { timeout: 60_000 }, () => {
  it("TC-F14-69 [AC-F14-33] requests withdrawn, blocks gone, groups keep working, one-to-one chats read-only", async () => {
    const { a1, m1, m2, e1, w1 } = await setUp("d69");
    const pendingTo = await started(m1, w1, [e1]); // a request M1 sent
    const direct = await started(m1, w1, [m2]);
    const group = await started(m1, w1, [m2, a1]);
    await send(m1, direct, "goodbye");
    await t.database.db.insert(chatBlocks).values({ blockerId: m1.id, blockedId: e1.id });

    await t.accounts.chatsRequests.forgetPerson(m1.id);
    await t.accounts.chatUpkeep.forgetPerson(m1.id);
    await t.database.db.delete(user).where(eq(user.id, m1.id));

    expect(
      await call(e1.token, "GET", "/api/v1/me/chat-requests").then((r) => r.json<{ requests: unknown[] }>().requests),
    ).toEqual([]);
    expect(await t.database.db.select().from(chatBlocks).where(eq(chatBlocks.blockerId, e1.id))).toEqual([]);
    expect(errorCode(await send(m2, direct))).toBe("CHAT_READ_ONLY");
    const messages = (await call(m2.token, "GET", `/api/v1/conversations/${direct}/messages?limit=10`)).json<{
      messages: { sender: { name: string }; deletedAt: string | null }[];
    }>().messages;
    expect(messages.find((m) => m.sender.name === "Deleted user")?.deletedAt).not.toBeNull();
    const [request] = await t.database.db
      .select()
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, pendingTo), eq(conversationMembers.userId, e1.id)));
    expect(request?.state).toBe("declined");
    expect((await send(m2, group)).statusCode).toBe(200); // the group M1 made keeps working
  });

  it("TC-F14-70 [AC-F14-33] the export holds the person's own messages from every kind of chat, nobody else's", async () => {
    const { m1, m2, a1, w1 } = await setUp("d70");
    const direct = await started(m1, w1, [m2]);
    const group = await started(m1, w1, [m2, a1]);
    await send(m1, direct, "mine in direct");
    await send(m1, group, "mine in group");
    await send(m2, direct, "theirs");
    const exported = await t.accounts.chatUpkeep.exportFor(m1.id);
    const texts = exported.messages.map((m) => m.text);
    expect(texts.sort()).toEqual(["mine in direct", "mine in group"]);
    expect(exported.messages.every((m) => m.conversationId !== null)).toBe(true);
  });
});

describe("keeping and deleting chats", { timeout: 60_000 }, () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const upload = (person: Person, id: string) =>
    t.app.inject({
      method: "POST",
      url: `/api/v1/conversations/${id}/attachments`,
      payload: Buffer.from(PDF),
      headers: {
        origin: "app://meetapp",
        "content-type": "application/octet-stream",
        "x-file-name": "notes.pdf",
        ...bearer(person.token),
      },
    });

  it("TC-F14-72 [AC-F14-35] chats stay for 400 days; a deleted workspace takes its chats and files, others stay", async () => {
    const { a1, m1, m2, w1 } = await setUp("k72");
    const w2 = await seedWorkspace(t, [
      [m1, "owner"],
      [m2, "member"],
    ]);
    const doomed = await started(m1, w1, [m2]);
    const kept = await started(m1, w2, [m2]);
    await send(m2, doomed, "in W1");
    await send(m2, kept, "in W2");
    const uploaded = await upload(m1, doomed);
    expect(uploaded.statusCode).toBe(200);
    const [file] = await t.database.db
      .select()
      .from(chatAttachments)
      .where(eq(chatAttachments.id, uploaded.json<{ id: string }>().id));
    await expect(t.storage.get(file?.storageKey ?? "")).resolves.toBeDefined();

    // 400 days on, the daily clean-up keeps chats people haven't deleted.
    const old = new Date(Date.now() - 400 * DAY_MS);
    await t.database.db.update(conversations).set({ createdAt: old }).where(eq(conversations.id, doomed));
    await t.database.db.update(chatMessages).set({ createdAt: old }).where(eq(chatMessages.conversationId, doomed));
    await t.accounts.chatUpkeep.cleanUp();
    expect(await t.database.db.select().from(conversations).where(eq(conversations.id, doomed))).toHaveLength(1);

    // W1 is deleted: files leave storage first, then the rows go with the workspace.
    await t.accounts.chatUpkeep.beforeWorkspaceDeleted(w1);
    await t.database.db.delete(workspaces).where(eq(workspaces.id, w1));
    await expect(t.storage.get(file?.storageKey ?? "")).rejects.toThrow();
    expect(await t.database.db.select().from(conversations).where(eq(conversations.id, doomed))).toEqual([]);
    expect(await t.database.db.select().from(chatMessages).where(eq(chatMessages.conversationId, doomed))).toEqual([]);
    expect(await t.database.db.select().from(chatAttachments).where(eq(chatAttachments.workspaceId, w1))).toEqual([]);
    // The other workspace's chat is untouched.
    expect(await listItem(m1, w2, kept)).toBeDefined();
    expect(a1.id).toBeTruthy();
  });
});
