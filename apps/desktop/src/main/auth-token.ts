// Where the desktop app keeps its sign-in token (F01 design.md section 4, AC-F01-34): only in the main
// process, encrypted with Electron's safeStorage (the key is held by the macOS Keychain or Windows'
// DPAPI) in the app's data folder. Without real encryption the token stays in memory only, so a restart
// signs out. Kept free of Electron imports so it can be tested with a fake safeStorage.
import { readFileSync, rmSync, writeFileSync } from "node:fs";

export interface SafeStorageLike {
  isEncryptionAvailable: () => boolean;
  /** Linux: "basic_text" means a fixed, well-known key, which is no protection. */
  getSelectedStorageBackend?: () => string;
  encryptString: (plain: string) => Buffer;
  decryptString: (encrypted: Buffer) => string;
}

export interface TokenStore {
  get: () => string | undefined;
  set: (token: string) => void;
  clear: () => void;
}

function canEncrypt(safeStorage: SafeStorageLike): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  return safeStorage.getSelectedStorageBackend?.() !== "basic_text";
}

function removeFile(file: string): void {
  rmSync(file, { force: true });
}

/** Reads the saved token; a damaged file, or one written with another key, is deleted. */
function readSaved(safeStorage: SafeStorageLike, file: string): string | undefined {
  let encrypted: Buffer;
  try {
    encrypted = readFileSync(file);
  } catch {
    return undefined;
  }
  try {
    const token = safeStorage.decryptString(encrypted);
    if (token !== "") return token;
  } catch {
    // Damaged, or encrypted with another key: treated as signed out.
  }
  removeFile(file);
  return undefined;
}

export function createTokenStore(safeStorage: SafeStorageLike, file: string): TokenStore {
  const encrypted = canEncrypt(safeStorage);
  // A file left from an earlier run is unusable when encryption is now unavailable.
  let token = encrypted ? readSaved(safeStorage, file) : (removeFile(file), undefined);
  return {
    get: () => token,
    set: (value) => {
      token = value;
      if (encrypted) writeFileSync(file, safeStorage.encryptString(value), { mode: 0o600 });
    },
    clear: () => {
      token = undefined;
      removeFile(file);
    },
  };
}
