// Reads the "Email addresses" field (AC-F01-17): addresses separated by commas, semicolons, spaces or
// new lines, trimmed and lower-cased, each once. At most 20 at a time; every one must look like an
// email, so nothing is sent while one is mistyped.
import { z } from "zod";

export const MAX_INVITES = 20;

export type ParsedEmails =
  | { ok: true; emails: string[] }
  | { ok: false; problem: "empty" | "tooMany" }
  | { ok: false; problem: "badEmail"; email: string };

const looksLikeEmail = (text: string) => z.email().max(254).safeParse(text).success;

export function parseEmails(text: string): ParsedEmails {
  const emails = [...new Set(text.split(/[\s,;]+/).map((part) => part.trim().toLowerCase()))].filter(Boolean);
  if (emails.length === 0) return { ok: false, problem: "empty" };
  if (emails.length > MAX_INVITES) return { ok: false, problem: "tooMany" };
  const bad = emails.find((email) => !looksLikeEmail(email));
  return bad === undefined ? { ok: true, emails } : { ok: false, problem: "badEmail", email: bad };
}
