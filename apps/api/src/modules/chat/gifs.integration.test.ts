// GIFs, stickers and the workspace GIF switch (F03 T7; design.md section 7; AC-F03-24, 26, 27). Real
// routes and database. The app searches KLIPY itself; the backend only hands out the settings and checks
// what is sent. Own database; needs the `pnpm dev` services.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { meetingWithTeam, roomOfFive, withTicket, type Joined } from "../../test-support/meetings-setup.ts";
import { errorCode } from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
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

const send = (who: Joined, callId: string, payload: object) =>
  withTicket(t, who.ticket, {
    method: "POST",
    url: `/api/v1/calls/${callId}/chat/messages`,
    payload: { clientId: randomUUID(), ...payload },
  });

const settingsOf = (who: Joined, callId: string) =>
  withTicket(t, who.ticket, { method: "GET", url: `/api/v1/calls/${callId}/chat/gif-settings` });

const setGifs = (token: string, workspaceId: string, allowGifs: boolean) =>
  t.app.inject({
    method: "PATCH",
    url: `/api/v1/workspaces/${workspaceId}/settings`,
    payload: { allowGifs },
    headers: { origin: "app://meetapp", authorization: `Bearer ${token}` },
  });

describe("GIF settings for the app", { timeout: 60_000 }, () => {
  it("TC-F03-43 [AC-F03-24] [AC-F03-27] people in the call get the key and a per-meeting id; others get nothing", async () => {
    const r = await roomOfFive(t, "gif-settings");
    const other = await roomOfFive(t, "gif-settings-2");
    const [attendee] = r.attendees;
    if (!attendee) throw new Error("people missing");
    const mine = await settingsOf(attendee, r.callId);
    expect(mine.statusCode, mine.body).toBe(200);
    const settings = mine.json<{ apiUrl: string; customerId: string }>();
    expect(settings.apiUrl).toMatch(/^https?:\/\//);
    expect(settings.customerId).toMatch(/^[0-9a-f]{32}$/);
    expect(settings.customerId).not.toContain(attendee.attendanceId.replaceAll("-", "").slice(0, 8));
    expect((await settingsOf(r.host, r.callId)).json<{ customerId: string }>().customerId).not.toBe(
      settings.customerId,
    );
    expect(errorCode(await settingsOf(other.host, r.callId))).toBe("NOT_FOUND");
    expect(errorCode(await settingsOf(attendee, other.callId))).toBe("NOT_FOUND");
  });
});

describe("GIF and sticker messages", { timeout: 60_000 }, () => {
  it("TC-F03-47 [AC-F03-24] [AC-F03-26] known stickers and KLIPY GIFs only", async () => {
    const r = await roomOfFive(t, "stickers");
    const sticker = await send(r.host, r.callId, { sticker: "thank-you" });
    expect(sticker.statusCode, sticker.body).toBe(200);
    expect(sticker.json<{ kind: string; sticker: string }>()).toMatchObject({ kind: "sticker", sticker: "thank-you" });
    const gif = await send(r.host, r.callId, { gif: GIF });
    expect(gif.statusCode, gif.body).toBe(200);
    expect(gif.json<{ kind: string; gif: { url: string } }>()).toMatchObject({ kind: "gif", gif: { url: GIF.url } });
    for (const payload of [
      { sticker: "free-money" },
      { gif: { ...GIF, url: "https://evil.example/cat.gif" } },
      { gif: { ...GIF, url: "javascript:alert(1)" } },
      { gif: { ...GIF, url: "http://static.klipy.com/cat.gif" } },
      { sticker: "thank-you", gif: GIF },
      { sticker: "thank-you", body: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] } },
    ]) {
      expect((await send(r.host, r.callId, payload)).statusCode).toBe(400);
    }
  });

  it("TC-F03-48 [AC-F03-27] owner and admin turn GIFs off; members can't; other things still work; other workspaces aren't touched", async () => {
    const r = await roomOfFive(t, "gifs-off");
    const other = await roomOfFive(t, "gifs-on");
    const [attendee] = r.attendees;
    if (!attendee) throw new Error("people missing");
    const workspaceId = r.meeting.workspaceId;
    // A plain member of a workspace can't change the switch.
    const team = await meetingWithTeam(t, "gifs-member", 1);
    const [member] = team.members;
    if (!member) throw new Error("people missing");
    expect((await setGifs(member.token, team.meeting.workspaceId, false)).statusCode).toBe(403);
    expect((await setGifs(r.organizer.token, workspaceId, false)).statusCode).toBe(204);
    expect(errorCode(await settingsOf(attendee, r.callId))).toBe("CHAT_GIFS_OFF");
    expect(errorCode(await send(attendee, r.callId, { gif: GIF }))).toBe("CHAT_GIFS_OFF");
    expect((await send(attendee, r.callId, { sticker: "agreed" })).statusCode).toBe(200);
    expect((await send(other.host, other.callId, { gif: GIF })).statusCode).toBe(200);
    expect((await setGifs(r.organizer.token, workspaceId, true)).statusCode).toBe(204);
    expect((await send(attendee, r.callId, { gif: GIF })).statusCode).toBe(200);
  });
});
