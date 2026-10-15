// The meeting ticket (F02 design.md section 6, D054): 32 random bytes given once per join, kept only in
// the app's memory, sent in its own header (X-Meeting-Ticket) because the desktop app sets
// Authorization itself. Only its SHA-256 fingerprint is stored. A missing or unknown ticket is the same
// 404 as a call that doesn't exist (S1, S2).
import { createHash, randomBytes } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { AppError } from "./errors.ts";

const TICKET_HEADER = "x-meeting-ticket";

export const newTicket = () => randomBytes(32).toString("base64url");
export const ticketFingerprint = (ticket: string) => createHash("sha256").update(ticket).digest("hex");

const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");

/** The fingerprint of the request's ticket; 404 when there is none or it can't be a ticket. */
export function ticketOf(request: FastifyRequest): string {
  const ticket = request.headers[TICKET_HEADER];
  if (typeof ticket !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw notFound();
  return ticketFingerprint(ticket);
}
