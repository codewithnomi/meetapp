// The lookup token (F02 design.md section 3.2): a 15-minute signed note naming one meeting, given after
// the right link or ID and passcode (or to the creator), so the passcode isn't sent again when joining.
// It says nothing about who may enter: joining checks everything again.
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

export const LOOKUP_TOKEN_MS = 15 * 60 * 1000;

interface LookupPayload {
  meetingId: string;
  /** Who looked it up: their account, or empty for a guest. A token works only for the same person. */
  userId: string | null;
  expiresAt: number;
}

export interface LookupGrant {
  meetingId: string;
  userId: string | null;
}

export function createLookupTokens(dataKey: string, now: () => Date = () => new Date()) {
  const key = Buffer.from(hkdfSync("sha256", dataKey, "meetapp", "meeting-lookup-token-v1", 32));
  const sign = (body: string) => createHmac("sha256", key).update(body).digest("base64url");

  return {
    issue: ({ meetingId, userId }: LookupGrant): string => {
      const payload: LookupPayload = { meetingId, userId, expiresAt: now().getTime() + LOOKUP_TOKEN_MS };
      const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
      return `${body}.${sign(body)}`;
    },
    /** The meeting and person it names, or undefined when it is forged, damaged or older than 15 minutes. */
    read: (token: string): LookupGrant | undefined => {
      const [body, signature, extra] = token.split(".");
      if (!body || !signature || extra !== undefined) return undefined;
      const expected = Buffer.from(sign(body));
      const given = Buffer.from(signature);
      if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
      try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<LookupPayload>;
        const { meetingId, userId, expiresAt } = payload;
        if (typeof meetingId !== "string" || typeof expiresAt !== "number") return undefined;
        if (userId !== null && typeof userId !== "string") return undefined;
        return expiresAt > now().getTime() ? { meetingId, userId } : undefined;
      } catch {
        return undefined;
      }
    },
  };
}

export type LookupTokens = ReturnType<typeof createLookupTokens>;
