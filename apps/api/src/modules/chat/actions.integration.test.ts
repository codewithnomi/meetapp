// Edits, deletes, reactions, replies and pins (F03 T4; design.md 3.5 and 3.6; AC-F03-10, 11, 13, 14,
// 19, 20). Real database; the call server's side is recorded. Own database; needs the `pnpm dev` services.
import { randomUUID } from "node:crypto";
import type { MessageDocument } from "@meetapp/contracts";
import { chatMessages } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ticketFingerprint } from "../../plugins/meeting-ticket.ts";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { joined, meetingWithTeam, roomOfFive, type Joined } from "../../test-support/meetings-setup.ts";
import { createChatActionsService } from "./chat-actions.service.ts";
import { createChatService } from "./chat.service.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const text = (value: string): MessageDocument => ({
  v: 1,
  blocks: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
});
const hashOf = (person: Joined) => ticketFingerprint(person.ticket);
const statusOfError = (work: Promise<unknown>) =>
  work.then(() => 200).catch((error: { status?: number; code?: string }) => error.code ?? error.status);

/** Chat services with a recording call server and no message limit. */
function services() {
  const packets: Record<string, unknown>[] = [];
  const real = t.accounts.callsDeps;
  const calls = {
    ...real,
    limiter: { ...real.limiter, take: async () => undefined },
    livekit: {
      ...real.livekit,
      sendChat: async (_room: string, payload: Uint8Array) => {
        packets.push(JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>);
      },
    },
  };
  const deps = { ...t.accounts.chatDeps, calls };
  return { chat: createChatService(deps), actions: createChatActionsService(deps), packets };
}

async function room(label: string) {
  const people = await roomOfFive(t, label);
  const [attendee, other] = people.attendees;
  if (!attendee || !other) throw new Error("people missing");
  return { ...people, attendee, other };
}

/** Sends text as `who` in `callId`, optionally as a reply. */
const sender =
  (chat: ReturnType<typeof services>["chat"], callId: string) => (who: Joined, value: string, replyToId?: string) =>
    chat.send(callId, hashOf(who), { clientId: randomUUID(), body: text(value), ...(replyToId ? { replyToId } : {}) });

const types = (packets: Record<string, unknown>[]) => packets.map((packet) => packet["type"]);

describe("editing and deleting", { timeout: 30_000 }, () => {
  it("TC-F03-18 [AC-F03-10] [AC-F03-11] only the sender edits; a deleted message can't be edited", async () => {
    const r = await room("edit");
    const { chat, actions, packets } = services();
    const message = await sender(chat, r.callId)(r.attendee, "Can we move to 11:00?");
    const on = (who: Joined) => ({ callId: r.callId, ticketHash: hashOf(who), messageId: message.id });
    for (const who of [r.other, r.host, r.co]) {
      expect(await statusOfError(actions.edit(on(who), text("changed")))).toBe("NOT_FOUND");
    }
    const edited = await actions.edit(on(r.attendee), text("Can we move to 11:30?"));
    expect(edited.editedAt).not.toBeNull();
    expect(types(packets)).toContain("message_edited");
    await actions.delete(on(r.attendee));
    expect(await statusOfError(actions.edit(on(r.attendee), text("again")))).toBe("NOT_FOUND");
  });

  it("TC-F03-19 [AC-F03-10] deleting removes the text, keeps who and when, and is delivered", async () => {
    const r = await room("delete");
    const { chat, actions, packets } = services();
    const message = await sender(chat, r.callId)(r.attendee, "secret plan");
    await actions.delete({ callId: r.callId, ticketHash: hashOf(r.attendee), messageId: message.id });
    const [stored] = await t.database.db.select().from(chatMessages).where(eq(chatMessages.id, message.id));
    expect(stored).toMatchObject({ body: null, plainText: null, gif: null, sticker: null });
    expect(stored?.deletedAt).not.toBeNull();
    expect(stored?.senderName).toBe(message.sender.name);
    expect(types(packets)).toContain("message_deleted");
  });

  it("TC-F03-19 [AC-F03-10] in a link meeting used again, messages of the earlier call can't be changed", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "reused");
    const first = await joined(t, meeting, organizer);
    const { chat, actions } = services();
    const old = await sender(chat, first.call?.callId ?? "")(first, "from last week");
    // The first call ends; the same meeting is joined again later.
    await t.app.inject({
      method: "POST",
      url: `/api/v1/calls/${first.call?.callId ?? ""}/end`,
      headers: { origin: "app://meetapp", "x-meeting-ticket": first.ticket },
    });
    const again = await joined(t, meeting, organizer);
    const callId = again.call?.callId ?? "";
    expect(callId).not.toBe(first.call?.callId);
    const on = { callId, ticketHash: hashOf(again), messageId: old.id };
    expect(await statusOfError(actions.edit(on, text("rewritten")))).toBe("CHAT_EDIT_ENDED");
    expect(await statusOfError(actions.delete(on))).toBe(200); // the organizer may still remove any message
  });

  it("TC-F03-20 [AC-F03-11] organizer and co-organizer delete others' messages; attendees and presenters can't; notes stay", async () => {
    const r = await room("moderate");
    const { chat, actions } = services();
    const tryDelete = async (who: Joined) => {
      const message = await sender(chat, r.callId)(r.other, "off-topic");
      return statusOfError(actions.delete({ callId: r.callId, ticketHash: hashOf(who), messageId: message.id }));
    };
    expect(await tryDelete(r.attendee)).toBe("NOT_FOUND");
    expect(await tryDelete(r.presenter)).toBe("NOT_FOUND");
    expect(await tryDelete(r.host)).toBe(200);
    expect(await tryDelete(r.co)).toBe(200);

    const pinned = await sender(chat, r.callId)(r.other, "agenda");
    await actions.pin({ callId: r.callId, ticketHash: hashOf(r.host), messageId: pinned.id });
    const [note] = await t.database.db.select().from(chatMessages).where(eq(chatMessages.kind, "system"));
    if (!note) throw new Error("no note");
    const deleteNote = actions.delete({ callId: r.callId, ticketHash: hashOf(r.host), messageId: note.id });
    expect(await statusOfError(deleteNote)).toBe("NOT_FOUND");
  });
});

describe("reactions and replies", { timeout: 30_000 }, () => {
  it("TC-F03-24 [AC-F03-13] one reaction per person (another replaces it), known emoji only, no double count", async () => {
    const r = await room("react");
    const { chat, actions, packets } = services();
    const message = await sender(chat, r.callId)(r.host, "Ship it?");
    const on = (who: Joined) => ({ callId: r.callId, ticketHash: hashOf(who), messageId: message.id });
    expect(await statusOfError(actions.react(on(r.attendee), "👍"))).toBe(200);
    expect(await statusOfError(actions.react(on(r.attendee), "❤️"))).toBe(200);
    for (const bad of ["hello", "<b>", "👍👍"]) {
      expect(await statusOfError(actions.react(on(r.other), bad))).toBe("CHAT_INVALID");
    }
    // The heart without its invisible "show as emoji" mark, and decomposed text, count as the same emoji.
    await actions.react(on(r.other), "❤");
    await actions.react(on(r.other), "❤️");
    const [view] = (await chat.page(r.callId, hashOf(r.other), { limit: 50 })).messages;
    const heart = view?.reactions.find((reaction) => reaction.emoji.startsWith("❤"));
    expect(heart?.count).toBe(2);
    // The attendee's 👍 was replaced by their ❤️.
    expect(view?.reactions.map((reaction) => reaction.emoji)).toHaveLength(1);
    expect(heart?.mine).toBe(true);
    expect(types(packets)).toContain("reactions_changed");
  });

  it("TC-F03-25 [AC-F03-14] a reply quotes the original as it is now, and only within the meeting", async () => {
    const r = await room("reply");
    const elsewhere = await room("reply-elsewhere");
    const { chat, actions } = services();
    const original = await sender(chat, r.callId)(r.host, "Release checklist for Thursday\nstep two");
    const reply = await sender(chat, r.callId)(r.other, "QA can sign off Wednesday", original.id);
    expect(reply.replyTo).toMatchObject({
      id: original.id,
      firstLine: "Release checklist for Thursday",
      deleted: false,
    });
    const on = { callId: r.callId, ticketHash: hashOf(r.host), messageId: original.id };
    await actions.edit(on, text("Release checklist for Friday"));
    const read = () => chat.one(r.callId, hashOf(r.other), reply.id);
    expect((await read()).replyTo?.firstLine).toBe("Release checklist for Friday");
    await actions.delete(on);
    expect((await read()).replyTo).toMatchObject({ firstLine: "This message was deleted", deleted: true });
    const foreign = await sender(chat, elsewhere.callId)(elsewhere.host, "other meeting");
    expect(await statusOfError(sender(chat, r.callId)(r.other, "cross", foreign.id))).toBe("CHAT_INVALID");
  });
});

describe("pins", { timeout: 30_000 }, () => {
  it("TC-F03-35 [AC-F03-19] [AC-F03-20] organizers pin up to 3, others can't, delete and unpin remove pins", async () => {
    const r = await room("pins");
    const { chat, actions, packets } = services();
    const messages = await Promise.all(["a", "b", "c", "d", "e"].map((v) => sender(chat, r.callId)(r.other, v)));
    const pin = (who: Joined, i: number) =>
      statusOfError(actions.pin({ callId: r.callId, ticketHash: hashOf(who), messageId: messages[i]?.id ?? "" }));
    expect(await pin(r.attendee, 0)).toBe("NOT_FOUND");
    expect(await pin(r.presenter, 0)).toBe("NOT_FOUND");
    expect(await pin(r.host, 0)).toBe(200);
    expect(await pin(r.co, 1)).toBe(200);
    // The 3rd and 4th at the same moment: exactly one of them fits.
    const both = await Promise.all([pin(r.host, 2), pin(r.co, 3)]);
    expect(both.sort()).toEqual([200, "CHAT_PINS_FULL"].sort());
    expect(await pin(r.host, 4)).toBe("CHAT_PINS_FULL");

    const pinnedNow = async () => (await actions.pinned(r.callId, hashOf(r.other))).pinned.map((m) => m.id);
    const [first, second] = await pinnedNow();
    await actions.delete({ callId: r.callId, ticketHash: hashOf(r.host), messageId: first ?? "" });
    await actions.unpin({ callId: r.callId, ticketHash: hashOf(r.co), messageId: second ?? "" });
    expect(await pinnedNow()).toHaveLength(1);
    const unpinByAttendee = actions.unpin({
      callId: r.callId,
      ticketHash: hashOf(r.attendee),
      messageId: second ?? "",
    });
    expect(await statusOfError(unpinByAttendee)).toBe("NOT_FOUND");
    expect(types(packets)).toContain("pins_changed");
    const notes = await t.database.db.select().from(chatMessages).where(eq(chatMessages.kind, "system"));
    expect(notes.some((note) => (note.system as { event: string }).event === "pinned")).toBe(true);
  });
});
