// Sending, reading and delivering chat messages (F03 T3; design.md 3.2–3.4; AC-F03-01–06, 17). Real
// routes and database; the call server's side is recorded. Own database; needs the `pnpm dev` services.
import { randomUUID } from "node:crypto";
import { chatEvents, chatMessages, conversations } from "@meetapp/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ticketFingerprint } from "../../plugins/meeting-ticket.ts";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { joined, meetingWithTeam, withTicket, type Joined } from "../../test-support/meetings-setup.ts";
import { errorCode } from "../../test-support/workspaces-setup.ts";
import { createChatService, MAX_PACKET_BYTES } from "./chat.service.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const text = (value: string) => ({ v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: value }] }] });

async function callOfTwo(label: string) {
  const { meeting, organizer, members } = await meetingWithTeam(t, label, 1);
  const [member] = members;
  if (!member) throw new Error("people missing");
  const host = await joined(t, meeting, organizer);
  const other = await joined(t, meeting, member);
  return { meeting, organizer, host, other, callId: host.call?.callId ?? "" };
}

const send = (who: Joined, callId: string, body: unknown, clientId: string = randomUUID()) =>
  withTicket(t, who.ticket, {
    method: "POST",
    url: `/api/v1/calls/${callId}/chat/messages`,
    payload: { clientId, body },
  });

/**
 * A chat service whose call server only records what it was asked to deliver. `unlimited` drops the
 * 10-in-10-seconds limit, for tests that fill a meeting with many messages.
 */
function recordedChat(unlimited = false) {
  const packets: { room: string; event: Record<string, unknown> }[] = [];
  const real = t.accounts.callsDeps;
  const livekit = {
    ...real.livekit,
    sendChat: async (room: string, payload: Uint8Array) => {
      packets.push({ room, event: JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown> });
    },
  };
  const limiter = unlimited ? { ...real.limiter, take: async () => undefined } : real.limiter;
  const chat = createChatService({ ...t.accounts.chatDeps, calls: { ...real, livekit, limiter } });
  return { chat, packets };
}

const storedFor = async (meetingId: string) =>
  t.database.db.select().from(chatMessages).where(eq(chatMessages.meetingId, meetingId));

describe("sending", { timeout: 30_000 }, () => {
  it("TC-F14-77 [AC-F14-28] a new meeting has its conversation; messages and their news carry it (D065)", async () => {
    const room = await callOfTwo("conversation");
    const { chat } = recordedChat();
    const view = await chat.send(room.callId, ticketFingerprint(room.other.ticket), {
      clientId: randomUUID(),
      body: text("hello") as never,
    });
    const [conversation] = await t.database.db
      .select()
      .from(conversations)
      .where(eq(conversations.meetingId, room.meeting.id));
    expect(conversation?.kind).toBe("meeting");
    const [message] = await t.database.db.select().from(chatMessages).where(eq(chatMessages.id, view.id));
    expect(message?.conversationId).toBe(conversation?.id);
    const news = await t.database.db.select().from(chatEvents).where(eq(chatEvents.meetingId, room.meeting.id));
    expect(news.map((event) => event.conversationId)).toEqual(news.map(() => conversation?.id));
  });

  it("TC-F03-01 [AC-F03-01] a message is saved with the sender's name and group and delivered to the room", async () => {
    const room = await callOfTwo("send");
    const { chat, packets } = recordedChat();
    const view = await chat.send(room.callId, ticketFingerprint(room.other.ticket), {
      clientId: randomUUID(),
      body: text("Can someone share the staging link?") as never,
    });
    expect(view.sender.group).toBe("member");
    expect(view.sender.name).not.toBe("");
    expect(packets).toHaveLength(1);
    expect(packets[0]?.room).toBe(room.callId);
    expect(packets[0]?.event).toMatchObject({ type: "message_created", id: view.id, message: { id: view.id } });
  });

  it("TC-F03-10 [AC-F03-05] the same clientId sent again (also in parallel) makes one message and one delivery", async () => {
    const room = await callOfTwo("twice");
    const { chat, packets } = recordedChat();
    const hash = ticketFingerprint(room.host.ticket);
    const input = { clientId: randomUUID(), body: text("only once") as never };
    const answers = await Promise.all(Array.from({ length: 5 }, () => chat.send(room.callId, hash, input)));
    expect(new Set(answers.map((answer) => answer.id)).size).toBe(1);
    expect(await storedFor(room.meeting.id)).toHaveLength(1);
    expect(packets).toHaveLength(1);
  });

  it.each([
    ["an empty message", text("")],
    ["spaces only", text("   ")],
    ["4,001 characters", text("a".repeat(4001))],
    ["an image block", { v: 1, blocks: [{ type: "image", src: "https://example.com/a.png" }] }],
    ["raw html", { v: 1, blocks: [{ type: "html", html: "<script>x</script>" }] }],
    [
      "a color mark",
      { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "color" }] }] }] },
    ],
    [
      "a javascript: link",
      {
        v: 1,
        blocks: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x", marks: [{ type: "link", href: "javascript:alert(1)" }] }],
          },
        ],
      },
    ],
    [
      "over 4,000 only because of code",
      {
        v: 1,
        blocks: [
          { type: "paragraph", content: [{ type: "text", text: "a".repeat(3990) }] },
          { type: "codeBlock", text: "b".repeat(20) },
        ],
      },
    ],
  ])("TC-F03-06 TC-F03-32 [AC-F03-03] [AC-F03-17] %s is refused and nothing is stored", async (_name, body) => {
    const room = await callOfTwo("refused");
    const answer = await send(room.host, room.callId, body);
    expect(answer.statusCode).toBe(400);
    expect(["CHAT_INVALID", "BAD_REQUEST"]).toContain(errorCode(answer));
    expect(await storedFor(room.meeting.id)).toHaveLength(0);
  });

  it("TC-F03-13 [AC-F03-06] the 11th message in 10 seconds is refused with the wait time", async () => {
    const room = await callOfTwo("fast");
    for (let i = 0; i < 10; i++)
      expect((await send(room.host, room.callId, text(`m${String(i)}`))).statusCode).toBe(200);
    const eleventh = await send(room.host, room.callId, text("one too many"));
    expect(eleventh.statusCode).toBe(429);
    expect(errorCode(eleventh)).toBe("CHAT_TOO_FAST");
    const seconds = eleventh.json<{ error: { retryAfterSeconds: number } }>().error.retryAfterSeconds;
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(10);
    // The limit is the sender's own: the other person still sends.
    expect((await send(room.other, room.callId, text("still fine"))).statusCode).toBe(200);
    // Per person, not per ticket: joining again gives no fresh 10 (F03 verification round 2).
    const again = await joined(t, room.meeting, room.organizer);
    expect(errorCode(await send(again, room.callId, text("after rejoining")))).toBe("CHAT_TOO_FAST");
  });

  it("TC-F03-92 [AC-F03-16] news too big for one packet carries only the id, and the message is fetched by id", async () => {
    const room = await callOfTwo("large");
    const { chat, packets } = recordedChat();
    const hash = ticketFingerprint(room.host.ticket);
    const body = {
      v: 1,
      blocks: [
        { type: "codeBlock", text: "x".repeat(3990) },
        ...Array.from({ length: 60 }, () => ({
          type: "paragraph",
          content: [
            { type: "text", text: "y", marks: [{ type: "link", href: `https://example.com/${"p".repeat(300)}` }] },
          ],
        })),
      ],
    };
    const view = await chat.send(room.callId, hash, { clientId: randomUUID(), body: body as never });
    expect(JSON.stringify(view).length).toBeGreaterThan(MAX_PACKET_BYTES);
    expect(packets[0]?.event).toEqual({ seq: expect.any(Number) as number, type: "message_created", id: view.id });
    expect((await chat.one(room.callId, hash, view.id)).id).toBe(view.id);
  });
});

describe("reading", { timeout: 60_000 }, () => {
  it("TC-F03-03 [AC-F03-02] pages of 50, newest first, without gaps or repeats, including messages sent before joining", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "pages", 1);
    const host = await joined(t, meeting, organizer);
    const callId = host.call?.callId ?? "";
    const { chat } = recordedChat(true);
    const hash = ticketFingerprint(host.ticket);
    for (let i = 0; i < 120; i++)
      await chat.send(callId, hash, { clientId: randomUUID(), body: text(`n${String(i)}`) as never });
    const [member] = members;
    if (!member) throw new Error("people missing");
    const late = await joined(t, meeting, member);
    const lateHash = ticketFingerprint(late.ticket);

    const seen: string[] = [];
    let before: string | undefined;
    const sizes: number[] = [];
    for (;;) {
      const page = await chat.page(callId, lateHash, { limit: 50, ...(before ? { before } : {}) });
      sizes.push(page.messages.length);
      seen.push(...page.messages.map((message) => message.id));
      before = page.messages.at(-1)?.cursor;
      if (!page.hasMore) break;
    }
    expect(sizes).toEqual([50, 50, 20]);
    // The first page carries the newest news number (120 messages, 120 pieces of news).
    expect((await chat.page(callId, lateHash, { limit: 50 })).lastSeq).toBe(120);
    expect(new Set(seen).size).toBe(120);
    const all = await storedFor(meeting.id);
    const newestFirst = [...all].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (b.id < a.id ? -1 : 1),
    );
    expect(seen).toEqual(newestFirst.map((message) => message.id));
  });

  it("TC-F03-92 [AC-F03-01] events after a number come back in order, and a cleaned gap is reported", async () => {
    const room = await callOfTwo("events");
    const { chat } = recordedChat(true);
    const hash = ticketFingerprint(room.host.ticket);
    for (let i = 0; i < 60; i++)
      await chat.send(room.callId, hash, { clientId: randomUUID(), body: text(`e${String(i)}`) as never });
    const missed = await chat.events(room.callId, hash, 10);
    expect(missed.gap).toBe(false);
    expect(missed.events.map((event) => event.seq)).toEqual(Array.from({ length: 50 }, (_, i) => i + 11));
    await t.database.db.execute(sql`delete from chat_events where meeting_id = ${room.meeting.id} and seq <= 30`);
    expect((await chat.events(room.callId, hash, 10)).gap).toBe(true);
  });

  it("TC-F03-03 [AC-F03-02] people outside the call, or with a bad cursor, get nothing", async () => {
    const room = await callOfTwo("outside");
    const other = await callOfTwo("elsewhere");
    const page = await withTicket(t, other.host.ticket, {
      method: "GET",
      url: `/api/v1/calls/${room.callId}/chat/messages`,
    });
    expect(page.statusCode).toBe(404);
    const noTicket = await withTicket(t, undefined, {
      method: "GET",
      url: `/api/v1/calls/${room.callId}/chat/messages`,
    });
    expect(noTicket.statusCode).toBe(404);
    const badCursor = await withTicket(t, room.host.ticket, {
      method: "GET",
      url: `/api/v1/calls/${room.callId}/chat/messages?before=nonsense`,
    });
    expect(badCursor.statusCode).toBe(400);
  });
});
