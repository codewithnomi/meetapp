// TC-F02-108 (AC-F02-52), security: a whole meeting (create, find, join, lobby, controls, the call
// server's reports, and forced errors) never writes a meeting secret to the logs: no call-server pass,
// meeting ticket, passcode, link part, lookup token or webhook body. Own database; needs the `pnpm dev`
// services.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { captureLogs, type CapturedLogs } from "../../test-support/fake-env.ts";
import { localConfig } from "../../test-support/integration.ts";
import { webhookBody, webhookSignature } from "../../test-support/livekit-events.ts";
import {
  joined,
  lookupToken,
  meetingWithTeam,
  newAddress,
  statusOf,
  withTicket,
  type Joined,
} from "../../test-support/meetings-setup.ts";

let t: AuthTestApp;
let logs: CapturedLogs;
beforeAll(async () => {
  logs = captureLogs();
  t = await startAuthTestApp({ logs: logs.stream });
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const config = () => ({ ...localConfig(), DATA_ENCRYPTION_KEY: "x".repeat(40) });
const WEBHOOK_MARK = "zzWebhookBody-5c1e77";
const secrets = new Map<string, string>();

async function report(room: string, signed: boolean) {
  const body = webhookBody({ event: "participant_joined", room, identity: WEBHOOK_MARK });
  const authorization = signed ? await webhookSignature(config(), body) : "Bearer eyJhbGciOiJIUzI1NiJ9.e30.bad";
  return t.app.inject({
    method: "POST",
    url: "/api/v1/livekit/webhook",
    payload: body,
    headers: { "content-type": "application/webhook+json", authorization },
  });
}

function remember(person: Joined, label: string) {
  secrets.set(`${label} ticket`, person.ticket);
  if (person.call) secrets.set(`${label} pass`, person.call.pass);
}

/** Every meeting step once, with the secrets each one carries. */
async function wholeMeeting() {
  const { meeting, organizer } = await meetingWithTeam(t, "logs");
  secrets.set("passcode", meeting.passcode);
  secrets.set("link part", meeting.link.split("/m/").pop() ?? "");
  const find = (payload: object) =>
    t.app.inject({
      method: "POST",
      url: "/api/v1/meeting-lookups",
      payload,
      remoteAddress: newAddress(),
      headers: { origin: "app://meetapp" },
    });
  secrets.set("lookup token", (await find({ link: meeting.link })).json<{ lookupToken: string }>().lookupToken);
  await find({ meetingNumber: meeting.meetingNumber, passcode: meeting.passcode });
  await find({ meetingNumber: meeting.meetingNumber, passcode: "WRONG1" });
  secrets.set("lookup token (signed in)", await lookupToken(t, meeting, organizer));
  const host = await joined(t, meeting, organizer);
  const guest = await joined(t, meeting, undefined, { guestName: "Log Guest" });
  remember(host, "organizer");
  const callId = host.call?.callId ?? "";
  const hostCall = (method: "GET" | "POST" | "PATCH", url: string, payload?: object) =>
    withTicket(t, host.ticket, { method, url: `/api/v1/calls/${callId}${url}`, ...(payload ? { payload } : {}) });
  await hostCall("GET", "/lobby");
  await hostCall("POST", "/lobby/admit", { attendanceIds: [guest.attendanceId] });
  remember({ ...guest, ...(await statusOf(t, guest)) }, "guest");
  await hostCall("GET", "/meeting");
  await hostCall("POST", "/hand", { raised: true });
  await hostCall("POST", `/participants/${guest.attendanceId}/mute`);
  await hostCall("PATCH", "", { locked: true });
  await report(callId, true);
  await report(callId, false);
  // Forced errors: a changed ticket, and a server error with secrets in the body.
  await withTicket(t, `${host.ticket.slice(0, -2)}xx`, { method: "GET", url: `/api/v1/calls/${callId}/meeting` });
  await t.app.inject({
    method: "POST",
    url: "/__test__/error",
    payload: { passcode: meeting.passcode, ticket: host.ticket, link: meeting.link },
    headers: { origin: "app://meetapp" },
  });
  await hostCall("POST", "/end");
}

describe("TC-F02-108 meeting secrets in logs", { timeout: 60_000 }, () => {
  it("TC-F02-108 [AC-F02-52] no log line holds a pass, ticket, passcode, link part, lookup token or webhook body", async () => {
    await wholeMeeting();
    await new Promise((settle) => setTimeout(settle, 200));
    const text = logs.text();
    expect(logs.lines().length).toBeGreaterThan(20);
    expect(secrets.size).toBeGreaterThanOrEqual(8);
    for (const [kind, secret] of secrets) {
      expect(secret.length, kind).toBeGreaterThan(5);
      expect(text.includes(secret), `${kind} in the logs`).toBe(false);
    }
    expect(text.includes(WEBHOOK_MARK), "webhook body in the logs").toBe(false);
    expect(text).toContain("/api/v1/livekit/webhook");
  });
});
