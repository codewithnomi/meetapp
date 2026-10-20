// The device key (F02 design.md section 5, AC-F02-35): a random 32-byte key made once for this app on
// this computer and kept in the app's settings folder. Joins send it so a removed guest coming back
// from the same app waits in the lobby; the backend keeps only its fingerprint.
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const KEY = /^[A-Za-z0-9_-]{43}$/;

function readKey(file: string): string | undefined {
  try {
    const value = readFileSync(file, "utf8").trim();
    return KEY.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The saved key, or a new one saved now (a missing or damaged file gets a new key). */
export function loadDeviceKey(file: string): string {
  const saved = readKey(file);
  if (saved) return saved;
  const key = randomBytes(32).toString("base64url");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, key, { mode: 0o600 });
  return key;
}
