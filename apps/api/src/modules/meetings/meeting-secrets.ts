// A meeting's secrets (F02 design.md section 3.1, AC-F02-03, AC-F02-52): the link's random part
// (128 bits), the 12-digit meeting ID and the 6-character passcode. The link part and passcode are kept
// encrypted (AES-256-GCM, with a key version) because Meeting info shows them again, and looked up only
// through keyed hashes (HMAC), so the database is never searched by a secret. Keys come from
// DATA_ENCRYPTION_KEY through HKDF, each with its own label (as the join link, D050).
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, randomInt } from "node:crypto";

const TAG_BYTES = 16;
export const MEETING_KEY_VERSION = 1;
/** Letters and digits without look-alikes: no 0/O, 1/l/I. */
const PASSCODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const PASSCODE_LENGTH = 6;
const LINK_PATH = "/m/";

/** The link's random part: 16 bytes in base64url (22 characters). */
export const newLinkPart = () => randomBytes(16).toString("base64url");
/** 12 digits, the first not 0. */
export const newMeetingNumber = () =>
  String(randomInt(1, 10)) + String(randomInt(0, 100_000_000_000)).padStart(11, "0");
export const newPasscode = () =>
  Array.from({ length: PASSCODE_LENGTH }, () => PASSCODE_ALPHABET[randomInt(PASSCODE_ALPHABET.length)]).join("");

/** Spaces in a typed meeting ID don't matter ("284 615 903 172"). */
export const normaliseMeetingNumber = (typed: string) => typed.replace(/\s/g, "");

export function createMeetingSecrets(dataKey: string, publicUrl: string) {
  const derive = (label: string) => Buffer.from(hkdfSync("sha256", dataKey, "meetapp", label, 32));
  const encryptionKey = derive("meeting-secret-enc-v1");
  const lookupKey = derive("meeting-lookup-v1");
  const hmac = (value: string) => createHmac("sha256", lookupKey).update(value).digest("hex");

  const seal = (plain: string): string => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv, { authTagLength: TAG_BYTES });
    const sealed = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString("base64");
  };
  const open = (stored: string, keyVersion: number): string => {
    if (keyVersion !== MEETING_KEY_VERSION) throw new Error(`unknown meeting key version ${String(keyVersion)}`);
    const bytes = Buffer.from(stored, "base64");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, bytes.subarray(0, 12), {
      authTagLength: TAG_BYTES,
    });
    decipher.setAuthTag(bytes.subarray(12, 12 + TAG_BYTES));
    return Buffer.concat([decipher.update(bytes.subarray(12 + TAG_BYTES)), decipher.final()]).toString("utf8");
  };

  return {
    seal,
    open,
    linkOf: (linkPart: string) => `${publicUrl}${LINK_PATH}${linkPart}`,
    /** The lookup hash of a link part, from a whole pasted link or just its part. */
    linkLookup: (typed: string) => {
      const text = typed.trim();
      const part = text.includes(LINK_PATH) ? (text.split(LINK_PATH).pop() ?? "") : text;
      return hmac(`link:${part.replace(/[/?#].*$/, "")}`);
    },
    passcodeCheck: (meetingNumber: string, passcode: string) =>
      hmac(`passcode:${normaliseMeetingNumber(meetingNumber)}:${passcode.trim()}`),
    /** A guest's device key, per meeting, so one guest's meetings can't be linked (design section 5). */
    guestDeviceHash: (meetingId: string, deviceKey: string) => hmac(`device:${meetingId}:${deviceKey}`),
  };
}

export type MeetingSecretBox = ReturnType<typeof createMeetingSecrets>;
