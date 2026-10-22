// Pins, polls, files and GIFs in one-to-one and group chats (F14 AC-F14-19), with F03's rules: any
// member pins (3 at most) and creates polls (only the creator closes); files are checked by content and
// limited (25 MB, 10 a minute, 2 GB per chat); GIFs follow the workspace switch. Cleaning a photo's
// location is F03's same file check (chat-files.test.ts).
import { randomUUID } from "node:crypto";
import { chatAttachments, workspaces } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { EXE, PDF } from "../../test-support/sample-files.ts";
import {
  caller,
  errorCode,
  namedPerson,
  seedWorkspace,
  type Call,
  type Person,
} from "../../test-support/workspaces-setup.ts";
import { MAX_FILE_BYTES } from "../chat/chat-files.ts";

let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const GIF = {
  id: "klipy-123",
  description: "GIF: thank you, waving cat",
  url: "https://static.klipy.com/ii/abc/thank-you.gif",
  width: 200,
  height: 150,
};
const text = (words: string) => ({ v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: words }] }] });

async function group(label: string) {
  const people = await Promise.all(
    [1, 2, 3].map((n) => namedPerson(t, `${label}-${String(n)}`, `Person ${String(n)}`)),
  );
  const [m1, m2, m3] = people as [Person, Person, Person];
  const workspaceId = await seedWorkspace(t, [
    [m1, "owner"],
    [m2, "member"],
    [m3, "member"],
  ]);
  const started = await call(m1.token, "POST", `/api/v1/workspaces/${workspaceId}/conversations`, {
    userIds: [m2.id, m3.id],
  });
  return { m1, m2, m3, workspaceId, id: started.json<{ id: string }>().id };
}

const send = (person: Person, id: string, payload: object) =>
  call(person.token, "POST", `/api/v1/conversations/${id}/messages`, { clientId: randomUUID(), ...payload });
const said = async (person: Person, id: string, words: string) =>
  (await send(person, id, { body: text(words) })).json<{ id: string }>().id;
const upload = (person: Person, id: string, bytes: Uint8Array, name: string) =>
  t.app.inject({
    method: "POST",
    url: `/api/v1/conversations/${id}/attachments`,
    payload: Buffer.from(bytes),
    headers: {
      origin: "app://meetapp",
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(name),
      ...bearer(person.token),
    },
  });

describe("pins, polls and GIFs in chats", { timeout: 60_000 }, () => {
  it("TC-F14-38 [AC-F14-19] any member pins (3 at most) and unpins anyone's pin", async () => {
    const { m1, m2, id } = await group("x38p");
    const ids = [];
    for (let i = 0; i < 4; i += 1) ids.push(await said(m1, id, `message ${String(i)}`));
    const pin = (person: Person, messageId: string | undefined) =>
      call(person.token, "POST", `/api/v1/conversations/${id}/pins`, { messageId });
    for (const messageId of ids.slice(0, 3)) expect((await pin(m1, messageId)).statusCode).toBe(204);
    const fourth = await pin(m2, ids[3]);
    expect(fourth.statusCode).toBe(409);
    expect(errorCode(fourth)).toBe("CHAT_PINS_FULL");
    expect((await call(m2.token, "DELETE", `/api/v1/conversations/${id}/pins/${ids[0] ?? ""}`)).statusCode).toBe(204);
    expect((await pin(m2, ids[3])).statusCode).toBe(204);
    const pinned = (await call(m1.token, "GET", `/api/v1/conversations/${id}/pins`)).json<{
      pinned: { id: string }[];
    }>();
    expect(pinned.pinned.map((m) => m.id).sort()).toEqual([ids[1], ids[2], ids[3]].sort());
  });

  it("TC-F14-38 [AC-F14-19] any member creates a poll; others vote; only the creator closes it", async () => {
    const { m2, m3, id } = await group("x38v");
    const created = await call(m2.token, "POST", `/api/v1/conversations/${id}/polls`, {
      clientId: randomUUID(),
      question: "Lunch?",
      options: ["Pizza", "Salad"],
      multiple: false,
      anonymous: false,
    });
    expect(created.statusCode).toBe(200);
    const poll = created.json<{ id: string; options: { id: string }[]; creatorName: string }>();
    expect(poll.creatorName).toBe("Person 2");
    const voted = await call(m3.token, "PUT", `/api/v1/conversations/${id}/polls/${poll.id}/vote`, {
      optionIds: [poll.options[0]?.id],
    });
    expect(voted.json<{ results: { options: { names: string[] }[] } }>().results.options[0]?.names).toEqual([
      "Person 3",
    ]);
    expect((await call(m3.token, "POST", `/api/v1/conversations/${id}/polls/${poll.id}/close`)).statusCode).toBe(404);
    expect((await call(m2.token, "POST", `/api/v1/conversations/${id}/polls/${poll.id}/close`)).statusCode).toBe(204);
    const late = await call(m3.token, "PUT", `/api/v1/conversations/${id}/polls/${poll.id}/vote`, {
      optionIds: [poll.options[1]?.id],
    });
    expect(errorCode(late)).toBe("CHAT_POLL_CLOSED");
  });

  it("TC-F14-38 [AC-F14-19] GIFs work while the workspace allows them", async () => {
    const { m1, workspaceId, id } = await group("x38g");
    expect((await send(m1, id, { gif: GIF })).statusCode).toBe(200);
    expect((await call(m1.token, "GET", `/api/v1/conversations/${id}/gif-settings`)).statusCode).toBe(200);
    await t.database.db.update(workspaces).set({ allowGifs: false }).where(eq(workspaces.id, workspaceId));
    const refused = await send(m1, id, { gif: GIF });
    expect(errorCode(refused)).toBe("CHAT_GIFS_OFF");
    expect(errorCode(await call(m1.token, "GET", `/api/v1/conversations/${id}/gif-settings`))).toBe("CHAT_GIFS_OFF");
  });
});

describe("files in chats", { timeout: 60_000 }, () => {
  it("TC-F14-37 [AC-F14-19] a file is checked, sent with a message and downloaded with a 5-minute link", async () => {
    const { m1, m2, id } = await group("x37a");
    const uploaded = await upload(m1, id, PDF, "notes.pdf");
    expect(uploaded.statusCode).toBe(200);
    const fileId = uploaded.json<{ id: string }>().id;
    // Someone else can't send M1's file.
    expect((await send(m2, id, { attachmentIds: [fileId] })).statusCode).toBe(400);
    expect((await send(m1, id, { attachmentIds: [fileId] })).statusCode).toBe(200);
    const link = await call(m2.token, "GET", `/api/v1/conversations/${id}/attachments/${fileId}/link`);
    expect(link.statusCode).toBe(200);
    const download = await t.app.inject({ method: "GET", url: link.json<{ url: string }>().url });
    expect(download.statusCode).toBe(200);
    expect(download.rawPayload.equals(Buffer.from(PDF))).toBe(true);

    expect(errorCode(await upload(m1, id, EXE, "photo.jpg"))).toBe("CHAT_FILE_TYPE");
    expect(errorCode(await upload(m1, id, new Uint8Array(MAX_FILE_BYTES + 1), "big.pdf"))).toBe("CHAT_FILE_TOO_BIG");
    const outsider = await namedPerson(t, "x37a-x", "Outsider");
    expect((await upload(outsider, id, PDF, "a.pdf")).statusCode).toBe(404);
  });

  it("TC-F14-37 [AC-F14-19] the 11th file in a minute and the file passing 2 GB are refused", async () => {
    const { m1, m2, workspaceId, id } = await group("x37b");
    for (let i = 0; i < 10; i += 1) expect((await upload(m1, id, PDF, "a.pdf")).statusCode).toBe(200);
    expect(errorCode(await upload(m1, id, PDF, "a.pdf"))).toBe("CHAT_FILE_RATE");

    await t.database.db.insert(chatAttachments).values({
      workspaceId,
      conversationId: id,
      fileName: "filler.pdf",
      mediaType: "application/pdf",
      sizeBytes: 2 * 1024 * 1024 * 1024 - 10,
      storageKey: `test/${randomUUID()}`,
      status: "ready",
    });
    expect(errorCode(await upload(m2, id, PDF, "a.pdf"))).toBe("CHAT_MEETING_FILES_FULL");
  });
});
