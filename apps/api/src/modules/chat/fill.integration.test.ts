// The F14 fill (design.md 4, "order of the change"; D065): meeting chat rows written before F14 get their
// conversation, in batches, while new messages keep arriving; nothing is lost and a re-run changes nothing.
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { roomOfFive, withTicket } from "../../test-support/meetings-setup.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const OLD_MESSAGES = 12_000;
const TEXT = { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "new" }] }] };

const count = async (query: ReturnType<typeof sql>) =>
  Number(((await t.database.db.execute(query)).rows[0] as { n: string }).n);
const withoutConversation = () =>
  count(sql`
    select (select count(*) from chat_messages where conversation_id is null and meeting_id is not null)
      + (select count(*) from chat_events where conversation_id is null and meeting_id is not null)
      + (select count(*) from chat_pins where conversation_id is null and meeting_id is not null)
      + (select count(*) from chat_polls where conversation_id is null and meeting_id is not null)
      + (select count(*) from chat_attachments where conversation_id is null and meeting_id is not null) as n`);

describe("filling conversations", { timeout: 180_000 }, () => {
  it("TC-F14-78 [AC-F14-28] old rows get their conversation in batches, while messages keep coming; a re-run changes nothing", async () => {
    const r = await roomOfFive(t, "fill");
    // Rows as F03 wrote them before F14: a meeting, but no conversation.
    await t.database.db.execute(sql`
      insert into chat_messages (meeting_id, workspace_id, sender_attendance_id, sender_name, sender_group, kind,
        plain_text, client_id)
      select ${r.meeting.id}, ${r.meeting.workspaceId}, ${r.host.attendanceId}, 'Example person', 'member', 'text',
        'old ' || g, gen_random_uuid()
      from generate_series(1, ${OLD_MESSAGES}) g`);
    await t.database.db.execute(sql`
      insert into chat_events (meeting_id, workspace_id, seq, type, payload)
      select ${r.meeting.id}, ${r.meeting.workspaceId}, 100000 + g, 'message_created', '{}'::jsonb
      from generate_series(1, 50) g`);
    const before = await count(sql`select count(*) as n from chat_messages where meeting_id = ${r.meeting.id}`);
    expect(await withoutConversation()).toBeGreaterThanOrEqual(OLD_MESSAGES);

    const sending = Promise.all(
      Array.from({ length: 5 }, () =>
        withTicket(t, r.host.ticket, {
          method: "POST",
          url: `/api/v1/calls/${r.callId}/chat/messages`,
          payload: { clientId: randomUUID(), body: TEXT },
        }),
      ),
    );
    const filled = await t.accounts.chatUpkeep.fillConversations();
    const sent = (await sending).filter((answer) => answer.statusCode === 200).length;

    expect(filled).toBeGreaterThanOrEqual(OLD_MESSAGES);
    expect(await withoutConversation()).toBe(0);
    const after = await count(sql`select count(*) as n from chat_messages where meeting_id = ${r.meeting.id}`);
    expect(after).toBe(before + sent);
    // One conversation per meeting, and the re-run has nothing left to do.
    expect(await count(sql`select count(*) as n from conversations where meeting_id = ${r.meeting.id}`)).toBe(1);
    expect(await t.accounts.chatUpkeep.fillConversations()).toBe(0);
  });
});
