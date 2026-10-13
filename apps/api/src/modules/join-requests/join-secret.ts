// The join link and code (F01 design.md section 5, AC-F01-19, S8). The link carries 24 random bytes; the
// code is 10 characters without look-alikes (no 0/O, 1/I). Both are kept encrypted (AES-256-GCM, with a
// key version) because members copy them again later, and looked up only through keyed hashes (HMAC),
// so the database is never searched by a secret. Both keys come from DATA_ENCRYPTION_KEY through HKDF,
// each with its own label.
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

/** The full 16-byte GCM tag, stated when decrypting so a shortened tag is refused. */
const TAG_BYTES = 16;

/** 32 characters: A–Z without I and O, and 2–9. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;
export const JOIN_KEY_VERSION = 1;

export interface JoinSecret {
  /** The random part of the link (base64url). */
  token: string;
  code: string;
}

/** The two lookup hashes a typed link or code could match. */
export interface JoinLookup {
  linkHmac: string;
  codeHmac: string;
}

function newCode(): string {
  // 32 characters, so each random byte's low 5 bits pick one evenly.
  return [...randomBytes(CODE_LENGTH)].map((byte) => CODE_ALPHABET[byte & 31]).join("");
}

/** Codes are typed by people: case, spaces and dashes don't matter. */
const normaliseCode = (text: string) => text.toUpperCase().replace(/[\s-]/g, "");

export function createJoinSecrets(dataKey: string, publicUrl: string) {
  const derive = (label: string) => Buffer.from(hkdfSync("sha256", dataKey, "meetapp", label, 32));
  const encryptionKey = derive("join-secret-enc-v1");
  const lookupKey = derive("join-lookup-v1");
  const hmac = (kind: "link" | "code", value: string) =>
    createHmac("sha256", lookupKey).update(`${kind}:${value}`).digest("hex");
  const linkPrefix = `${publicUrl}/join/`;

  return {
    create: (): JoinSecret => ({ token: randomBytes(24).toString("base64url"), code: newCode() }),
    linkOf: (secret: JoinSecret) => `${linkPrefix}${secret.token}`,
    hashes: (secret: JoinSecret): JoinLookup => ({
      linkHmac: hmac("link", secret.token),
      codeHmac: hmac("code", secret.code),
    }),
    /** Whatever was typed or pasted: the whole link, the link's random part, or the code. */
    lookupFor: (typed: string): JoinLookup => {
      const text = typed.trim();
      const token = text.includes("/join/") ? (text.split("/join/").pop() ?? "") : text;
      return { linkHmac: hmac("link", token.replace(/[/?#].*$/, "")), codeHmac: hmac("code", normaliseCode(text)) };
    },
    encrypt: (secret: JoinSecret): string => {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv, { authTagLength: TAG_BYTES });
      const sealed = Buffer.concat([cipher.update(JSON.stringify(secret), "utf8"), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString("base64");
    },
    decrypt: (stored: string, keyVersion: number): JoinSecret => {
      if (keyVersion !== JOIN_KEY_VERSION) throw new Error(`unknown join key version ${String(keyVersion)}`);
      const bytes = Buffer.from(stored, "base64");
      const decipher = createDecipheriv("aes-256-gcm", encryptionKey, bytes.subarray(0, 12), {
        authTagLength: TAG_BYTES,
      });
      decipher.setAuthTag(bytes.subarray(12, 28));
      const plain = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
      return JSON.parse(plain) as JoinSecret;
    },
  };
}

export type JoinSecrets = ReturnType<typeof createJoinSecrets>;
