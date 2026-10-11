// Reads emails from the local fake inbox (Mailpit) in integration tests: wait for a message to one
// address, and pull a 6-digit code out of it. Needs the `pnpm dev` services running.
import { setting } from "./integration.ts";

export interface InboxMessage {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  Created: string;
}

function mailpit(path: string): string {
  return `http://127.0.0.1:${setting("MAILPIT_WEB_PORT")}/api/v1/${path}`;
}

async function messagesTo(address: string): Promise<InboxMessage[]> {
  const query = encodeURIComponent(`to:"${address}"`);
  const response = await fetch(mailpit(`search?query=${query}&limit=50`), { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Mailpit search failed with ${String(response.status)}`);
  return ((await response.json()) as { messages: InboxMessage[] }).messages;
}

/** Waits until a message to `address` sent after `since` (and matching `subject`, if given) arrives. */
export async function waitForEmail(
  address: string,
  options: { since: Date; subject?: RegExp; timeoutMs?: number },
): Promise<InboxMessage> {
  const deadline = Date.now() + (options.timeoutMs ?? 10_000);
  while (Date.now() < deadline) {
    const found = (await messagesTo(address)).find(
      (message) =>
        new Date(message.Created) >= options.since &&
        (options.subject === undefined || options.subject.test(message.Subject)),
    );
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`No email to ${address} arrived in time`);
}

/** How many messages to `address` arrived after `since`. */
export async function countEmails(address: string, since: Date): Promise<number> {
  return (await messagesTo(address)).filter((message) => new Date(message.Created) >= since).length;
}

/** The full message: plain text and HTML. */
export async function readEmail(id: string): Promise<{ Text: string; HTML: string; Subject: string }> {
  const response = await fetch(mailpit(`message/${id}`), { signal: AbortSignal.timeout(5_000) });
  return (await response.json()) as { Text: string; HTML: string; Subject: string };
}

/** The 6-digit code in the newest code email to `address` after `since`. */
export async function latestCode(address: string, since: Date): Promise<string> {
  const message = await waitForEmail(address, { since, subject: /code/i });
  const code = /\b(\d{6})\b/.exec(message.Subject)?.[1];
  if (!code) throw new Error("The code email has no 6-digit code in its subject");
  return code;
}
