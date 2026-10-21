// Chat security sweeps (F03 T9; security.md S1, S2, S10, S11): ids from another meeting are refused
// everywhere, names and poll text are kept as plain text, and a whole chat flow writes no chat text to
// the logs. The outsider sweep over every route is TC-F02-102/TC-F03-79 (meeting-sweep.integration.test.ts).
// Own database; needs the `pnpm dev` services.
import { randomUUID } from "node:crypto";
import { chatAttachments, chatPolls } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { captureLogs, type CapturedLogs } from "../../test-support/fake-env.ts";
import { newAddress, roomOfFive, type Joined } from "../../test-support/meetings-setup.ts";
import { PDF } from "../../test-support/sample-files.ts";
import { errorCode } from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
let logs: CapturedLogs;
beforeAll(async () => {
  logs = captureLogs();
  t = await startAuthTestApp({ logs: logs.stream });
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const doc = (text: string) => ({ v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const call = (who: Joined, method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT", url: string, payload?: object) =>
  t.app.inject({
    method,
    url,
    ...(payload ? { payload } : {}),
    remoteAddress: newAddress(),
    headers: { origin: "app://meetapp", "x-meeting-ticket": who.ticket },
  });
const upload = (who: Joined, callId: string, name: string) =>
  t.app.inject({
    method: "POST",
    url: `/api/v1/calls/${callId}/chat/attachments`,
    payload: Buffer.from(PDF),
    remoteAddress: newAddress(),
    headers: {
      origin: "app://meetapp",
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(name),
      "x-meeting-ticket": who.ticket,
    },
  });

describe("TC-F03-80 ids from another meeting", { timeout: 60_000 }, () => {
  it("TC-F03-80 [AC-F03-14] [AC-F03-19] [AC-F03-28] a meeting's ids are refused in another meeting, without revealing anything", async () => {
    const a = await roomOfFive(t, "cross-a");
    const b = await roomOfFive(t, "cross-b");
    const message = (
      await call(a.host, "POST", `/api/v1/calls/${a.callId}/chat/messages`, {
        clientId: randomUUID(),
        body: doc("A's"),
      })
    ).json<{ id: string }>();
    const file = (await upload(a.host, a.callId, "a.pdf")).json<{ id: string }>();
    const poll = (
      await call(a.host, "POST", `/api/v1/calls/${a.callId}/chat/polls`, {
        clientId: randomUUID(),
        question: "A?",
        options: ["x", "y"],
        multiple: false,
        anonymous: false,
      })
    ).json<{ id: string; options: { id: string }[] }>();
    const base = `/api/v1/calls/${b.callId}/chat`;
    const tries = [
      await call(b.host, "POST", `${base}/messages`, {
        clientId: randomUUID(),
        body: doc("quote"),
        replyToId: message.id,
      }),
      await call(b.host, "POST", `${base}/messages`, { clientId: randomUUID(), attachmentIds: [file.id] }),
      await call(b.host, "PUT", `${base}/polls/${poll.id}/vote`, { optionIds: [poll.options[0]?.id] }),
      await call(b.host, "POST", `${base}/pins`, { messageId: message.id }),
      await call(b.host, "POST", `${base}/messages/${message.id}/reactions`, { emoji: "👍" }),
      await call(b.host, "GET", `${base}/messages/${message.id}`),
      await call(b.host, "GET", `${base}/attachments/${file.id}/link`),
      await call(b.host, "DELETE", `${base}/messages/${message.id}`),
    ];
    for (const answer of tries) {
      expect(answer.statusCode).toBeGreaterThanOrEqual(400);
      expect(["NOT_FOUND", "CHAT_INVALID"]).toContain(errorCode(answer));
      expect(answer.body).not.toContain("A's");
    }
    // Nothing in A changed.
    const [stillOpen] = await t.database.db.select().from(chatPolls).where(eq(chatPolls.id, poll.id));
    expect(stillOpen?.version).toBe(0);
  });
});

describe("TC-F03-82 names and poll text are plain text", { timeout: 60_000 }, () => {
  it("TC-F03-82 [AC-F03-04] [AC-F03-28] file names are cleaned; HTML is kept as text, never changed into markup", async () => {
    const r = await roomOfFive(t, "names");
    const html = "<img src=x onerror=alert(1)>.pdf";
    const uploaded = (await upload(r.host, r.callId, html)).json<{ id: string; fileName: string }>();
    // Kept exactly as text (the app shows it as text, never as markup).
    expect(uploaded.fileName).toBe(html);
    const path = (await upload(r.host, r.callId, "../../etc/passwd.pdf")).json<{ fileName: string }>();
    expect(path.fileName).toBe("passwd.pdf");
    const [row] = await t.database.db.select().from(chatAttachments).where(eq(chatAttachments.id, uploaded.id));
    expect(row?.fileName).toBe(uploaded.fileName);
    const poll = await call(r.host, "POST", `/api/v1/calls/${r.callId}/chat/polls`, {
      clientId: randomUUID(),
      question: "<script>alert(1)</script>?",
      options: ["<b>yes</b>", "no"],
      multiple: false,
      anonymous: false,
    });
    expect(poll.json<{ question: string }>().question).toBe("<script>alert(1)</script>?");
    expect(poll.headers["content-type"]).toMatch(/^application\/json/);
  });
});

describe("TC-F03-87 logs contain no chat text", { timeout: 90_000 }, () => {
  it("TC-F03-87 [AC-F03-01] a whole chat flow, with errors, writes no chat text, file names or tickets to the logs", async () => {
    const r = await roomOfFive(t, "logs");
    const MARK = "zzChatMarker7f3a";
    const sent = (
      await call(r.host, "POST", `/api/v1/calls/${r.callId}/chat/messages`, {
        clientId: randomUUID(),
        body: doc(`${MARK}-text https://example.com/${MARK}-link`),
      })
    ).json<{ id: string }>();
    await call(r.host, "PATCH", `/api/v1/calls/${r.callId}/chat/messages/${sent.id}`, { body: doc(`${MARK}-edit`) });
    await upload(r.host, r.callId, `${MARK}-file.pdf`);
    await upload(r.host, r.callId, `${MARK}-refused.exe`);
    await call(r.host, "POST", `/api/v1/calls/${r.callId}/chat/polls`, {
      clientId: randomUUID(),
      question: `${MARK}-question`,
      options: [`${MARK}-a`, `${MARK}-b`],
      multiple: false,
      anonymous: false,
    });
    await call(r.host, "POST", `/api/v1/calls/${r.callId}/chat/messages`, {
      clientId: randomUUID(),
      gif: { id: "1", description: `${MARK}-gif`, url: "https://evil.example/x.gif", width: 1, height: 1 },
    });
    await call(r.host, "POST", `/api/v1/calls/${r.callId}/chat/messages`, {
      clientId: randomUUID(),
      body: doc("x".repeat(5000) + MARK),
    });
    const text = logs.text();
    expect(logs.lines().length).toBeGreaterThan(5);
    expect(text.includes(MARK), "chat text in the logs").toBe(false);
    expect(text.includes(r.host.ticket), "a ticket in the logs").toBe(false);
  });
});
