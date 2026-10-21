// Files and pictures in chat (F03 T6; design.md section 6; AC-F03-28, 30, 31, 33, 34). Real routes,
// database and private storage (RustFS). Own database; needs the `pnpm dev` services.
import { randomUUID } from "node:crypto";
import { chatAttachments } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ticketFingerprint } from "../../plugins/meeting-ticket.ts";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { joined, newAddress, roomOfFive, withTicket, type Joined } from "../../test-support/meetings-setup.ts";
import { EXE, OLD_OFFICE, PDF, officeFile, png } from "../../test-support/sample-files.ts";
import { errorCode } from "../../test-support/workspaces-setup.ts";
import { LINK_SECONDS, createChatFilesService } from "./chat-files.service.ts";
import { MAX_FILE_BYTES } from "./chat-files.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const upload = (who: Joined, callId: string, bytes: Uint8Array, name: string) =>
  t.app.inject({
    method: "POST",
    url: `/api/v1/calls/${callId}/chat/attachments`,
    payload: Buffer.from(bytes),
    remoteAddress: newAddress(),
    headers: {
      origin: "app://meetapp",
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(name),
      "x-meeting-ticket": who.ticket,
    },
  });

const sendWith = (who: Joined, callId: string, attachmentIds: string[], text?: string) =>
  withTicket(t, who.ticket, {
    method: "POST",
    url: `/api/v1/calls/${callId}/chat/messages`,
    payload: {
      clientId: randomUUID(),
      attachmentIds,
      ...(text ? { body: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text }] }] } } : {}),
    },
  });

const linkFor = (who: Joined, callId: string, attachmentId: string, preview = false) =>
  withTicket(t, who.ticket, {
    method: "GET",
    url: `/api/v1/calls/${callId}/chat/attachments/${attachmentId}/link${preview ? "?preview=true" : ""}`,
  });

const rowsOf = (meetingId: string) =>
  t.database.db.select().from(chatAttachments).where(eq(chatAttachments.meetingId, meetingId));

async function room(label: string) {
  const people = await roomOfFive(t, label);
  const [attendee, other] = people.attendees;
  if (!attendee || !other) throw new Error("people missing");
  const guest = await joined(t, people.meeting);
  await t.app.inject({
    method: "POST",
    url: `/api/v1/calls/${people.callId}/lobby/admit`,
    payload: { attendanceIds: [guest.attendanceId] },
    headers: { origin: "app://meetapp", "x-meeting-ticket": people.host.ticket },
  });
  return { ...people, attendee, other, guest };
}

describe("uploading and sending", { timeout: 60_000 }, () => {
  it("TC-F03-51 [AC-F03-28] allowed files are stored with their checked type, sent with a message, and downloaded safely", async () => {
    const r = await room("send-files");
    const files = [
      [await png(64, 32), "chart.png"],
      [PDF, "plan.pdf"],
      [officeFile("docx"), "notes.docx"],
      [new TextEncoder().encode("a,b\n1,2\n"), "table.csv"],
    ] as const;
    const ids: string[] = [];
    for (const [bytes, name] of files) {
      const answer = await upload(r.attendee, r.callId, new Uint8Array(bytes), name);
      expect(answer.statusCode, answer.body).toBe(200);
      ids.push(answer.json<{ id: string }>().id);
    }
    const sent = await sendWith(r.attendee, r.callId, ids);
    expect(sent.statusCode, sent.body).toBe(200);
    const attachments = sent.json<{ attachments: { mediaType: string; hasPreview: boolean }[] }>().attachments;
    expect(attachments.map((a) => a.mediaType)).toEqual([
      "image/png",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain; charset=utf-8",
    ]);
    expect(attachments[0]?.hasPreview).toBe(true);

    const link = await linkFor(r.other, r.callId, ids[3] ?? "");
    expect(link.statusCode).toBe(200);
    const download = await t.app.inject({ method: "GET", url: link.json<{ url: string }>().url });
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-disposition"]).toMatch(/^attachment;/);
    expect(download.headers["x-content-type-options"]).toBe("nosniff");
    expect(download.headers["content-type"]).toBe("text/plain; charset=utf-8");
    expect(download.body).toBe("a,b\n1,2\n");
  });

  it("TC-F03-51 [AC-F03-28] an 11th file in one message is refused; files are only the sender's own", async () => {
    const r = await room("eleven");
    const { files } = filesWithoutLimits();
    const ids: string[] = [];
    for (let i = 0; i < 11; i++) {
      const uploaded = await files.upload({
        callId: r.callId,
        ticketHash: ticketFingerprint(r.attendee.ticket),
        fileName: `n${String(i)}.pdf`,
        bytes: PDF,
      });
      ids.push(uploaded.id);
    }
    expect((await sendWith(r.attendee, r.callId, ids)).statusCode).toBe(400);
    // Another person can't send someone else's file.
    const stolen = await sendWith(r.other, r.callId, ids.slice(0, 1));
    expect(errorCode(stolen)).toBe("CHAT_INVALID");
  });

  it.each([
    ["25 MB + 1 byte", new Uint8Array(MAX_FILE_BYTES + 1), "big.txt", "CHAT_FILE_TOO_BIG"],
    ["a renamed program", EXE, "report.pdf", "CHAT_FILE_TYPE"],
    ["an old .doc", OLD_OFFICE, "a.doc", "CHAT_FILE_TYPE"],
    ["a macro file", officeFile("docx", true), "a.docx", "CHAT_FILE_TYPE"],
    ["an empty file", new Uint8Array(), "a.txt", "CHAT_FILE_TYPE"],
  ])("TC-F03-52 [AC-F03-30] %s is refused and nothing is stored", async (_name, bytes, name, code) => {
    const r = await room("refused-files");
    const answer = await upload(r.attendee, r.callId, bytes, name);
    expect(errorCode(answer)).toBe(code);
    expect(await rowsOf(r.meeting.id)).toHaveLength(0);
  });
});

/** The file service with no upload limit and its own clock. */
function filesWithoutLimits(now = () => new Date()) {
  const real = t.accounts.callsDeps;
  const calls = { ...real, now, limiter: { ...real.limiter, take: async () => undefined } };
  return { files: createChatFilesService({ ...t.accounts.chatDeps, calls }, t.storage) };
}

describe("who gets files", { timeout: 60_000 }, () => {
  it("TC-F03-58 [AC-F03-33] guests can't upload, send files or get links", async () => {
    const r = await room("guest-files");
    expect(errorCode(await upload(r.guest, r.callId, PDF, "a.pdf"))).toBe("NOT_FOUND");
    const own = (await upload(r.attendee, r.callId, PDF, "a.pdf")).json<{ id: string }>().id;
    expect((await sendWith(r.attendee, r.callId, [own])).statusCode).toBe(200);
    expect(errorCode(await sendWith(r.guest, r.callId, [own], "mine now"))).toBe("NOT_FOUND");
    expect(errorCode(await linkFor(r.guest, r.callId, own))).toBe("NOT_FOUND");
    expect((await rowsOf(r.meeting.id)).length).toBe(1);
  });

  it("TC-F03-56 TC-F03-86 [AC-F03-31] links work 5 minutes, can't be changed, and outsiders get none", async () => {
    const r = await room("links");
    const elsewhere = await room("links-elsewhere");
    const id = (await upload(r.attendee, r.callId, PDF, "a.pdf")).json<{ id: string }>().id;
    await sendWith(r.attendee, r.callId, [id]);
    let clock = Date.now();
    const { files } = filesWithoutLimits(() => new Date(clock));
    const { url } = await files.link(r.callId, ticketFingerprint(r.other.ticket), id, false);
    const token = url.split("/").pop() ?? "";
    expect((await files.download(token)).mediaType).toBe("application/pdf");
    clock += (LINK_SECONDS - 60) * 1000;
    expect((await files.download(token)).bytes.length).toBe(PDF.length);
    clock += 2 * 60 * 1000;
    await expect(files.download(token)).rejects.toMatchObject({ status: 404 });
    const [fileId, kind, end, signature] = token.split(".");
    await expect(
      files.download(`${fileId ?? ""}.${kind ?? ""}.${String(Number(end) + 600_000)}.${signature ?? ""}`),
    ).rejects.toMatchObject({ status: 404 });
    await expect(files.download(`${randomUUID()}.${kind ?? ""}.${end ?? ""}.${signature ?? ""}`)).rejects.toMatchObject(
      { status: 404 },
    );
    expect(errorCode(await linkFor(elsewhere.host, r.callId, id))).toBe("NOT_FOUND");
    expect(errorCode(await linkFor(elsewhere.host, elsewhere.callId, id))).toBe("NOT_FOUND");
  });
});

describe("limits", { timeout: 120_000 }, () => {
  it("TC-F03-60 [AC-F03-34] the 11th upload in a minute is refused", async () => {
    const r = await room("rate");
    for (let i = 0; i < 10; i++) expect((await upload(r.attendee, r.callId, PDF, "a.pdf")).statusCode).toBe(200);
    expect(errorCode(await upload(r.attendee, r.callId, PDF, "a.pdf"))).toBe("CHAT_FILE_RATE");
    // Counted per person: joining again with a new ticket gives no 10 more (F03 verification).
    const again = await joined(t, r.meeting, r.people.first);
    expect(errorCode(await upload(again, r.callId, PDF, "a.pdf"))).toBe("CHAT_FILE_RATE");
  });

  it("TC-F03-60 [AC-F03-34] a meeting holds 500 MB of files, unsent ones included, even when uploads race", async () => {
    const r = await room("full");
    // Fill the meeting with records just under the limit, then race two real uploads for the last space.
    const used = 500 * 1024 * 1024 - PDF.length * 1.5;
    await t.database.db.insert(chatAttachments).values({
      workspaceId: r.meeting.workspaceId,
      meetingId: r.meeting.id,
      fileName: "filler.pdf",
      mediaType: "application/pdf",
      sizeBytes: Math.floor(used),
      storageKey: `test/${randomUUID()}`,
      status: "ready",
    });
    const { files } = filesWithoutLimits();
    const tryUpload = (who: Joined) =>
      files
        .upload({ callId: r.callId, ticketHash: ticketFingerprint(who.ticket), fileName: "a.pdf", bytes: PDF })
        .then(() => "ok")
        .catch((error: { code?: string }) => error.code);
    expect((await Promise.all([tryUpload(r.attendee), tryUpload(r.other)])).sort()).toEqual([
      "CHAT_MEETING_FILES_FULL",
      "ok",
    ]);
  });
});
