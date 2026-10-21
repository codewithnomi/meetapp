// A chat sender for the load test (F03 TC-F03-02): joins the meeting through the backend as a guest
// (the organizer's app lets it in), then sends messages with its meeting ticket, as any app would.
import { randomBytes, randomUUID } from "node:crypto";

const API = process.env["MEETAPP_E2E_API_URL"] ?? "";
const HEADERS = { origin: "app://meetapp", "content-type": "application/json" };

async function post<T>(path: string, body: object, ticket?: string): Promise<T> {
  const answer = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { ...HEADERS, ...(ticket ? { "x-meeting-ticket": ticket } : {}) },
    body: JSON.stringify(body),
  });
  if (!answer.ok) throw new Error(`${path} answered ${String(answer.status)}: ${await answer.text()}`);
  return (await answer.json()) as T;
}

export interface ChatSender {
  /** Sends `text` and returns when the request left (ms since 1970, the app's clock too). */
  send: (text: string) => Promise<number>;
}

/** Asks to join by the link; the caller lets the guest in, then calls the returned `ready`. */
export async function knockAsGuest(link: string, name: string) {
  const { lookupToken } = await post<{ lookupToken: string }>("/api/v1/meeting-lookups", { link });
  const joined = await post<{ ticket: string; call?: { callId: string } }>("/api/v1/meetings/join", {
    lookupToken,
    deviceKey: randomBytes(32).toString("base64url"),
    guestName: name,
  });
  return {
    ready: (callId: string): ChatSender => ({
      send: async (text) => {
        const sentAt = Date.now();
        await post(
          `/api/v1/calls/${callId}/chat/messages`,
          {
            clientId: randomUUID(),
            body: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text }] }] },
          },
          joined.ticket,
        );
        return sentAt;
      },
    }),
  };
}
