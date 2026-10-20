// Unit tests for a meeting's secrets, expiry and lookup tokens (F02 design.md sections 3.1 and 3.2).
import { describe, expect, it } from "vitest";
import { MEETING_LIFETIME_MS, extendedExpiry, firstExpiry, isExpired } from "./expiry.ts";
import { LOOKUP_TOKEN_MS, createLookupTokens } from "./lookup-token.ts";
import {
  MEETING_KEY_VERSION,
  createMeetingSecrets,
  newLinkPart,
  newMeetingNumber,
  newPasscode,
} from "./meeting-secrets.ts";

const KEY = "unit-test-data-key-0123456789abcdef";
const DAY = 24 * 60 * 60 * 1000;

describe("TC-F02-01 [AC-F02-03] secret formats", () => {
  it("TC-F02-01 [AC-F02-03] 10,000 draws: link parts, IDs and passcodes have the right shape; no link part repeats", () => {
    const parts = new Set<string>();
    for (let draw = 0; draw < 10_000; draw++) {
      const part = newLinkPart();
      expect(part).toMatch(/^[A-Za-z0-9_-]{22}$/);
      parts.add(part);
      expect(newMeetingNumber()).toMatch(/^[1-9]\d{11}$/);
      expect(newPasscode()).toMatch(/^[A-HJ-NP-Za-km-z2-9]{6}$/);
    }
    expect(parts.size).toBe(10_000);
  });

  it("TC-F02-01 [AC-F02-03] a link part carries 128 random bits", () => {
    expect(Buffer.from(newLinkPart(), "base64url")).toHaveLength(16);
  });

  it("TC-F02-05 [AC-F02-03] [AC-F02-52] sealed secrets open again only with the same key and version", () => {
    const secrets = createMeetingSecrets(KEY, "https://meetapp.example.test");
    const sealed = secrets.seal("h3Tq9z");
    expect(sealed).not.toContain("h3Tq9z");
    expect(secrets.open(sealed, MEETING_KEY_VERSION)).toBe("h3Tq9z");
    expect(() => secrets.open(sealed, MEETING_KEY_VERSION + 1)).toThrow();
    expect(() => createMeetingSecrets(`${KEY}-other`, "https://x.test").open(sealed, MEETING_KEY_VERSION)).toThrow();
  });

  it("TC-F02-04 [AC-F02-03] a pasted link, its bare part and the ID with spaces find the same hashes", () => {
    const secrets = createMeetingSecrets(KEY, "https://meetapp.example.test");
    const part = newLinkPart();
    const lookup = secrets.linkLookup(part);
    expect(secrets.linkLookup(` ${secrets.linkOf(part)} `)).toBe(lookup);
    expect(secrets.linkLookup(`${secrets.linkOf(part)}?from=mail`)).toBe(lookup);
    expect(secrets.linkLookup(newLinkPart())).not.toBe(lookup);
    expect(secrets.passcodeCheck("284 615 903 172", "h3Tq9z")).toBe(secrets.passcodeCheck("284615903172", "h3Tq9z"));
    expect(secrets.passcodeCheck("284615903172", "h3Tq9Z")).not.toBe(secrets.passcodeCheck("284615903172", "h3Tq9z"));
  });

  it("TC-F02-73 [AC-F02-35] a guest's device key gives a different hash in every meeting", () => {
    const secrets = createMeetingSecrets(KEY, "https://x.test");
    expect(secrets.guestDeviceHash("m1", "device")).toBe(secrets.guestDeviceHash("m1", "device"));
    expect(secrets.guestDeviceHash("m1", "device")).not.toBe(secrets.guestDeviceHash("m2", "device"));
  });
});

describe("TC-F02-06 [AC-F02-04] expiry calculation", () => {
  const created = new Date("2026-10-01T10:00:00Z");
  const at = (days: number, hours = 0) => new Date(created.getTime() + days * DAY + hours * 3_600_000);

  it("TC-F02-06 [AC-F02-04] a new meeting works for exactly 60 days", () => {
    const expiresAt = firstExpiry(created);
    expect(expiresAt.getTime() - created.getTime()).toBe(MEETING_LIFETIME_MS);
    expect(isExpired(expiresAt, at(59, 23))).toBe(false);
    expect(isExpired(expiresAt, at(60))).toBe(true);
  });

  it("TC-F02-06 [AC-F02-04] Meet now is never extended; a link meeting gets 60 days from the latest join or change", () => {
    const expiresAt = firstExpiry(created);
    expect(extendedExpiry("meet_now", expiresAt, at(59))).toEqual(expiresAt);
    const extended = extendedExpiry("link", expiresAt, at(59));
    expect(extended).toEqual(at(119));
    expect(isExpired(extended, at(118, 23))).toBe(false);
    // An older change never shortens the expiry.
    expect(extendedExpiry("link", extended, at(10))).toEqual(extended);
  });
});

describe("TC-F02-105 [AC-F02-48] lookup tokens", () => {
  it("TC-F02-105 [AC-F02-48] name one meeting for 15 minutes; forged or damaged ones are refused", () => {
    let clock = new Date("2026-10-01T10:00:00Z");
    const tokens = createLookupTokens(KEY, () => clock);
    const token = tokens.issue({ meetingId: "meeting-1", userId: "user-1" });
    expect(tokens.read(token)).toEqual({ meetingId: "meeting-1", userId: "user-1" });
    expect(tokens.read(tokens.issue({ meetingId: "meeting-1", userId: null }))).toEqual({
      meetingId: "meeting-1",
      userId: null,
    });
    expect(createLookupTokens(`${KEY}-other`, () => clock).read(token)).toBeUndefined();
    const [body = "", signature = ""] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ meetingId: "meeting-2", userId: null, expiresAt: 9e15 })).toString(
      "base64url",
    );
    expect(tokens.read(`${forged}.${signature}`)).toBeUndefined();
    expect(tokens.read(`${body}.${signature}x`)).toBeUndefined();
    expect(tokens.read("nonsense")).toBeUndefined();
    clock = new Date(clock.getTime() + LOOKUP_TOKEN_MS);
    expect(tokens.read(token)).toBeUndefined();
  });
});
