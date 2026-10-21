// Polls (F03 T5; design.md 3.7; AC-F03-21–23). Real database; the call server's side is recorded.
// Own database; needs the `pnpm dev` services.
import { randomUUID } from "node:crypto";
import { callAttendances, chatPollVotes, chatPolls } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ticketFingerprint } from "../../plugins/meeting-ticket.ts";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { joined, roomOfFive, type Joined } from "../../test-support/meetings-setup.ts";
import { createChatPollsService, type PollInput } from "./chat-polls.service.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const hashOf = (person: Joined) => ticketFingerprint(person.ticket);
const statusOfError = (work: Promise<unknown>) =>
  work.then(() => 200).catch((error: { status?: number; code?: string }) => error.code ?? error.status);

function pollService() {
  const packets: Record<string, unknown>[] = [];
  const real = t.accounts.callsDeps;
  const livekit = {
    ...real.livekit,
    sendChat: async (_room: string, payload: Uint8Array) => {
      packets.push(JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>);
    },
  };
  return { polls: createChatPollsService({ ...t.accounts.chatDeps, calls: { ...real, livekit } }), packets };
}

const poll = (extra: Partial<PollInput> = {}): PollInput => ({
  clientId: randomUUID(),
  question: "Which day should we release?",
  options: ["Tuesday", "Wednesday", "Thursday"],
  multiple: false,
  anonymous: false,
  ...extra,
});

async function room(label: string) {
  const people = await roomOfFive(t, label);
  const [attendee, other] = people.attendees;
  if (!attendee || !other) throw new Error("people missing");
  const guest = await joined(t, people.meeting);
  // Guests wait in the lobby by default; let this one in.
  await t.app.inject({
    method: "POST",
    url: `/api/v1/calls/${people.callId}/lobby/admit`,
    payload: { attendanceIds: [guest.attendanceId] },
    headers: { origin: "app://meetapp", "x-meeting-ticket": people.host.ticket },
  });
  // Everyone joins as a presenter by default (as in Teams); this guest is made an attendee.
  await t.database.db
    .update(callAttendances)
    .set({ roleOverride: "attendee" })
    .where(eq(callAttendances.id, guest.attendanceId));
  return { ...people, attendee, other, guest };
}

describe("creating and voting", { timeout: 30_000 }, () => {
  it("TC-F03-37 [AC-F03-21] [AC-F03-23] organizers and presenters create polls; attendees and guests can't; limits hold", async () => {
    const r = await room("create");
    const { polls, packets } = pollService();
    const create = (who: Joined, extra?: Partial<PollInput>) =>
      statusOfError(polls.create(r.callId, hashOf(who), poll(extra)));
    expect(await create(r.host)).toBe(200);
    expect(await create(r.co)).toBe(200);
    expect(await create(r.presenter, { multiple: true, anonymous: true })).toBe(200);
    expect(await create(r.attendee)).toBe("NOT_FOUND");
    expect(await create(r.guest)).toBe("NOT_FOUND");
    expect(packets.filter((packet) => packet["type"] === "message_created")).toHaveLength(3);
  });

  it.each([
    ["a 201-character question", { question: "q".repeat(201) }],
    ["one answer", { options: ["only"] }],
    ["11 answers", { options: Array.from({ length: 11 }, (_, i) => `a${String(i)}`) }],
    ["a 101-character answer", { options: ["ok", "o".repeat(101)] }],
  ])("TC-F03-37 [AC-F03-21] %s is refused", async (_name, extra) => {
    const r = await room("limits");
    const answer = await t.app.inject({
      method: "POST",
      url: `/api/v1/calls/${r.callId}/chat/polls`,
      payload: poll(extra),
      headers: { origin: "app://meetapp", "x-meeting-ticket": r.host.ticket },
    });
    expect(answer.statusCode).toBe(400);
  });

  it("TC-F03-38 [AC-F03-22] [AC-F03-23] each person counts once, may change, and can't vote after close", async () => {
    const r = await room("vote");
    const { polls } = pollService();
    const single = await polls.create(r.callId, hashOf(r.host), poll());
    const multi = await polls.create(r.callId, hashOf(r.host), poll({ multiple: true }));
    const [a, b] = single.options.map((option) => option.id);
    const on = (who: Joined, p = single) => ({ callId: r.callId, ticketHash: hashOf(who), pollId: p.id });
    await polls.vote(on(r.attendee), [a ?? ""]);
    await polls.vote(on(r.guest), [a ?? ""]);
    const changed = await polls.vote(on(r.attendee), [b ?? ""]);
    expect(changed.yourChoice).toEqual([b]);
    expect(changed.results?.voters).toBe(2);
    expect(await statusOfError(polls.vote(on(r.attendee), [a ?? "", b ?? ""]))).toBe("CHAT_INVALID");
    const [m1, m2] = multi.options.map((option) => option.id);
    const both = await polls.vote(on(r.attendee, multi), [m1 ?? "", m2 ?? "", m1 ?? ""]);
    expect(both.results?.options.map((option) => option.votes)).toEqual([1, 1, 0]);
    expect(await statusOfError(polls.vote(on(r.attendee), [m1 ?? ""]))).toBe("CHAT_INVALID");
    await polls.close(on(r.host));
    expect(await statusOfError(polls.vote(on(r.other), [a ?? ""]))).toBe("CHAT_POLL_CLOSED");
  });

  it("TC-F03-39 [AC-F03-22] results only after voting, except for the creator and organizers; news has no results", async () => {
    const r = await room("results");
    const { polls, packets } = pollService();
    const created = await polls.create(r.callId, hashOf(r.presenter), poll());
    const on = (who: Joined) => ({ callId: r.callId, ticketHash: hashOf(who), pollId: created.id });
    await polls.vote(on(r.other), [created.options[0]?.id ?? ""]);
    expect((await polls.get(on(r.attendee))).results).toBeNull();
    expect((await polls.get(on(r.other))).results?.voters).toBe(1);
    for (const who of [r.presenter, r.host, r.co]) expect((await polls.get(on(who))).results?.voters).toBe(1);
    const changed = packets.filter((packet) => packet["type"] === "poll_changed");
    expect(changed.length).toBeGreaterThan(0);
    for (const packet of changed)
      expect(Object.keys(packet).sort()).toEqual(["id", "pollId", "seq", "type", "version"]);
  });

  it("TC-F03-38 [AC-F03-22] two votes at the same moment announce two different versions", async () => {
    const r = await room("together");
    const { polls, packets } = pollService();
    const created = await polls.create(r.callId, hashOf(r.presenter), poll());
    const on = (who: Joined) => ({ callId: r.callId, ticketHash: hashOf(who), pollId: created.id });
    const option = created.options[0]?.id ?? "";
    await Promise.all([polls.vote(on(r.other), [option]), polls.vote(on(r.attendee), [option])]);
    const versions = packets.filter((packet) => packet["type"] === "poll_changed").map((packet) => packet["version"]);
    expect(new Set(versions).size).toBe(2);
  });
});

describe("anonymous polls and closing", { timeout: 30_000 }, () => {
  it("TC-F03-40 [AC-F03-22] an anonymous poll keeps no person and no time, and names nobody", async () => {
    const r = await room("anon");
    const { polls, packets } = pollService();
    const created = await polls.create(r.callId, hashOf(r.host), poll({ anonymous: true }));
    const voters = [r.host, r.co, r.presenter, r.attendee, r.guest];
    for (const who of voters) {
      await polls.vote({ callId: r.callId, ticketHash: hashOf(who), pollId: created.id }, [
        created.options[0]?.id ?? "",
      ]);
    }
    const rows = await t.database.db.select().from(chatPollVotes).where(eq(chatPollVotes.pollId, created.id));
    const [stored] = await t.database.db.select().from(chatPolls).where(eq(chatPolls.id, created.id));
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.attendanceId).toBeNull();
      expect(row.createdAt.getTime()).toBe(stored?.createdAt.getTime());
      expect(row.voterKey).toMatch(/^[0-9a-f]{64}$/);
    }
    const seen = JSON.stringify([
      ...(await Promise.all(
        [r.host, r.co].map((who) => polls.get({ callId: r.callId, ticketHash: hashOf(who), pollId: created.id })),
      )),
      packets,
    ]);
    // The creator is named on the poll itself; nothing links any voter to a choice.
    for (const who of voters.filter((person) => person !== r.host)) {
      expect(seen).not.toContain(who.attendanceId);
      expect(seen).not.toContain(hashOf(who));
    }
    expect(seen).not.toMatch(/"names":\["/);
    // The same voter has a different key in another poll, so polls can't be linked.
    const second = await polls.create(r.callId, hashOf(r.host), poll({ anonymous: true }));
    await polls.vote({ callId: r.callId, ticketHash: hashOf(r.attendee), pollId: second.id }, [
      second.options[0]?.id ?? "",
    ]);
    const [secondRow] = await t.database.db.select().from(chatPollVotes).where(eq(chatPollVotes.pollId, second.id));
    expect(rows.map((row) => row.voterKey)).not.toContain(secondRow?.voterKey);
  });

  it("TC-F03-41 [AC-F03-23] the creator, organizer and co-organizers close polls; open polls close when the call ends", async () => {
    const r = await room("close");
    const { polls } = pollService();
    const make = () => polls.create(r.callId, hashOf(r.presenter), poll());
    const close = async (who: Joined) => {
      const p = await make();
      return statusOfError(polls.close({ callId: r.callId, ticketHash: hashOf(who), pollId: p.id }));
    };
    expect(await close(r.attendee)).toBe("NOT_FOUND");
    expect(await close(r.presenter)).toBe(200);
    expect(await close(r.host)).toBe(200);
    expect(await close(r.co)).toBe(200);
    const left = await make();
    await t.app.inject({
      method: "POST",
      url: `/api/v1/calls/${r.callId}/end`,
      headers: { origin: "app://meetapp", "x-meeting-ticket": r.host.ticket },
    });
    const [row] = await t.database.db.select().from(chatPolls).where(eq(chatPolls.id, left.id));
    expect(row?.closedAt).not.toBeNull();
  });
});
