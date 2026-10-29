// Simulated chat members for the 250-person group load test (F14 TC-F14-42). The backend allows 50
// sign-ups an hour, so the people are written straight into the test database (as `pnpm seed` does):
// an account, membership of the desktop person's workspace and a session whose token only this test
// knows (the database keeps its SHA-256 fingerprint, as for any session). Each one then opens a live line
// with that token and sends messages through the normal API, as the app would. Node's own WebSocket
// (undici) sends the Authorization header with the upgrade.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sql } from "../e2e/desktop/backend-control.ts";

const API = process.env["MEETAPP_E2E_API_URL"] ?? "";
const HEADERS = { origin: "app://meetapp", "content-type": "application/json" };
/** The app pings every 30 s; lines without one for 2 minutes are closed (design 3.4). */
const PING_MS = 30_000;

export interface Member {
  id: string;
  token: string;
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Adds `count` people to the workspace called `workspace`; returns them with their session tokens. */
export function addMembers(workspace: string, count: number): Member[] {
  const run = randomUUID().slice(0, 8);
  const people = Array.from({ length: count }, (_, i) => ({
    id: randomUUID(),
    token: randomBytes(32).toString("hex"),
    email: `load-${run}-${String(i)}@example.test`,
    name: `Load Person ${String(i)}`,
  }));
  const users = people
    .map((p) => `(${quote(p.id)}, ${quote(p.name)}, ${quote(p.email)}, true, 'load', now(), now())`)
    .join(",\n");
  const sessions = people
    .map(
      (p) => `(${quote(p.id)}, ${quote(createHash("sha256").update(p.token).digest("hex"))}, now() + interval '1 day')`,
    )
    .join(",\n");
  sql(`BEGIN;
INSERT INTO "user" (id, name, email, email_verified, terms_version, terms_accepted_at, age_confirmed_at) VALUES
${users};
INSERT INTO session (user_id, token, expires_at) VALUES
${sessions};
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT w.id, u.id, 'member' FROM workspaces w, "user" u
WHERE w.name = ${quote(workspace)} AND u.email LIKE ${quote(`load-${run}-%`)};
COMMIT;`);
  return people.map(({ id, token }) => ({ id, token }));
}

/** Removes the simulated people (their sessions, memberships and messages' authorship go with them). */
export function removeMembers(members: Member[]): void {
  if (members.length === 0) return;
  sql(`DELETE FROM "user" WHERE id IN (${members.map((m) => quote(m.id)).join(",")});`);
}

export const userIdOf = (email: string): string => sql(`SELECT id FROM "user" WHERE email = ${quote(email)};`);
export const workspaceIdOf = (name: string): string => sql(`SELECT id FROM workspaces WHERE name = ${quote(name)};`);

async function postRaw(path: string, body: object, token: string): Promise<Response> {
  return fetch(`${API}${path}`, {
    method: "POST",
    headers: { ...HEADERS, authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

async function post<T>(path: string, body: object, token: string): Promise<T> {
  const answer = await postRaw(path, body, token);
  if (!answer.ok) throw new Error(`${path} answered ${String(answer.status)}: ${await answer.text()}`);
  return (await answer.json()) as T;
}

/** `starter` makes a group of everyone in `userIds` (themselves included by the server). */
export async function startGroup(starter: Member, workspaceId: string, userIds: string[], name: string) {
  const { id } = await post<{ id: string }>(
    `/api/v1/workspaces/${workspaceId}/conversations`,
    { userIds, name },
    starter.token,
  );
  return id;
}

/** Sends `text` to the conversation; returns when the request left (ms since 1970, the app's clock too). */
export async function send(member: Member, conversationId: string, text: string): Promise<number> {
  const sentAt = Date.now();
  await post(
    `/api/v1/conversations/${conversationId}/messages`,
    { clientId: randomUUID(), body: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text }] }] } },
    member.token,
  );
  return sentAt;
}

export interface CrowdLines {
  /** Message news received per line, for `conversationId`. */
  received: () => number[];
  /** Lines that closed before `stop` was called. */
  dropped: () => number;
  stop: () => void;
}

/** Is this line message the news of a new message in `conversationId`? */
function isNewMessage(data: unknown, conversationId: string): boolean {
  const message = JSON.parse(String(data)) as { t: string; conversationId?: string; event?: { type: string } };
  return message.t === "news" && message.conversationId === conversationId && message.event?.type === "message_created";
}

/** One member's live line; `onNews` runs for each new message, `onClose` when the line closes. */
function openLine(member: Member, conversationId: string, onNews: () => void, onClose: () => void) {
  const url = `${API.replace(/^http/, "ws")}/api/v1/realtime`;
  return new Promise<WebSocket>((opened, failed) => {
    // undici's WebSocket takes request headers as a second argument (not in the browser's).
    const Socket = WebSocket as unknown as new (url: string, init: object) => WebSocket;
    const socket = new Socket(url, { headers: { origin: HEADERS.origin, authorization: `Bearer ${member.token}` } });
    socket.addEventListener("open", () => {
      opened(socket);
    });
    socket.addEventListener("error", () => {
      failed(new Error(`the line of ${member.id} did not open`));
    });
    socket.addEventListener("close", onClose);
    socket.addEventListener("message", (event) => {
      if (isNewMessage(event.data, conversationId)) onNews();
    });
  });
}

/** Opens a live line for every member; resolves when all are open. */
export async function openLines(members: Member[], conversationId: string): Promise<CrowdLines> {
  const counts = members.map(() => 0);
  let dropped = 0;
  let stopping = false;
  const sockets = await Promise.all(
    members.map((member, i) =>
      openLine(
        member,
        conversationId,
        () => (counts[i] = (counts[i] ?? 0) + 1),
        () => {
          if (!stopping) dropped += 1;
        },
      ),
    ),
  );
  const pinger = setInterval(() => {
    for (const socket of sockets) if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: "ping" }));
  }, PING_MS);
  return {
    received: () => [...counts],
    dropped: () => dropped,
    stop: () => {
      stopping = true;
      clearInterval(pinger);
      for (const socket of sockets) socket.close();
    },
  };
}

// Chat calls (F15 TC-F15-76, 77): starting, accepting and ringing through the normal API.
export interface CallAnswer {
  status: number;
  /** The API's error code (e.g. CALL_FULL) when refused. */
  code?: string | undefined;
  callId?: string | undefined;
  /** How long the request took, ms. */
  ms: number;
  /** When the request left (ms since 1970). */
  sentAt: number;
}

async function callRequest(path: string, media: "video" | "audio", token: string): Promise<CallAnswer> {
  const sentAt = Date.now();
  const answer = await postRaw(path, { media }, token);
  const ms = Date.now() - sentAt;
  // Errors come as { error: { code } } (the standard error body).
  const body = (await answer.json().catch(() => ({}))) as { call?: { callId: string }; error?: { code?: string } };
  return { status: answer.status, code: body.error?.code, callId: body.call?.callId, ms, sentAt };
}

export const startCall = (member: Member, conversationId: string, media: "video" | "audio" = "video") =>
  callRequest(`/api/v1/conversations/${conversationId}/calls`, media, member.token);

/** **Join** a running chat call (for people who weren't rung, e.g. groups of more than 20). */
export const joinCall = (member: Member, callId: string) =>
  callRequest(`/api/v1/calls/${callId}/join`, "video", member.token);

export const acceptCall = (member: Member, callId: string, media: "video" | "audio" = "video") =>
  callRequest(`/api/v1/calls/${callId}/accept`, media, member.token);

/** The first `ring` each line received, by call: when it arrived (ms since 1970). */
export interface RingLines {
  /** Arrival time of the `ring` for `callId` on each line that got one, with the line's index. */
  rings: (callId: string) => { line: number; at: number }[];
  dropped: () => number;
  stop: () => void;
}

/** Opens a live line for every member that notes the `ring` messages it gets. */
export async function openRingLines(members: Member[]): Promise<RingLines> {
  const seen = members.map(() => new Map<string, number>());
  let dropped = 0;
  let stopping = false;
  const url = `${API.replace(/^http/, "ws")}/api/v1/realtime`;
  const Socket = WebSocket as unknown as new (url: string, init: object) => WebSocket;
  const sockets = await Promise.all(
    members.map(
      (member, i) =>
        new Promise<WebSocket>((opened, failed) => {
          const socket = new Socket(url, {
            headers: { origin: HEADERS.origin, authorization: `Bearer ${member.token}` },
          });
          socket.addEventListener("open", () => {
            opened(socket);
          });
          socket.addEventListener("error", () => {
            failed(new Error(`the line of ${member.id} did not open`));
          });
          socket.addEventListener("close", () => {
            if (!stopping) dropped += 1;
          });
          socket.addEventListener("message", (event) => {
            const message = JSON.parse(String(event.data)) as { t: string; callId?: string };
            if (message.t === "ring" && message.callId && !seen[i]?.has(message.callId))
              seen[i]?.set(message.callId, Date.now());
          });
        }),
    ),
  );
  const pinger = setInterval(() => {
    for (const socket of sockets) if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: "ping" }));
  }, PING_MS);
  return {
    rings: (callId) =>
      seen.flatMap((calls, line) => {
        const at = calls.get(callId);
        return at === undefined ? [] : [{ line, at }];
      }),
    dropped: () => dropped,
    stop: () => {
      stopping = true;
      clearInterval(pinger);
      for (const socket of sockets) socket.close();
    },
  };
}
