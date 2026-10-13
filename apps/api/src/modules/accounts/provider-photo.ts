// The Google/Microsoft photo, copied once after the first sign-in (F01 design.md section 6, AC-F01-07).
// Only from Google's own photo addresses, or the copy Better Auth already took from Microsoft; no
// redirects, at most 5 MB and 5 seconds. Any problem leaves the initials; it never fails the sign-in.
import { randomUUID } from "node:crypto";
import { MAX_PHOTO_BYTES, toAvatarWebp } from "./avatar-image.ts";

const TIME_LIMIT_MS = 5_000;
const GOOGLE_PHOTO_HOST = /^[a-z0-9-]+\.googleusercontent\.com$/;
/** What Better Auth stores after fetching a Microsoft photo itself. */
const DATA_ADDRESS = /^data:image\/[a-z+]+;base64,\s*([A-Za-z0-9+/=]+)$/;

export interface ProviderPhotoDependencies {
  users: {
    providerImage: (userId: string) => Promise<string | null>;
    finishProviderPhoto: (userId: string, avatarKey: string | undefined) => Promise<void>;
  };
  storage: { put: (key: string, body: Uint8Array, contentType: string) => Promise<void> };
  onProblem: (problem: unknown) => void;
}

export const avatarStorageKey = (userId: string, avatarKey: string) => `avatars/${userId}/${avatarKey}.webp`;

async function readLimited(response: Response): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES) throw new Error("photo too large");
  const parts: Uint8Array[] = [];
  let size = 0;
  for await (const part of response.body ?? []) {
    size += part.length;
    if (size > MAX_PHOTO_BYTES) throw new Error("photo too large");
    parts.push(part);
  }
  return Buffer.concat(parts);
}

/** The picture's bytes, or undefined when its address isn't one we fetch from. */
async function downloadProviderPhoto(address: string): Promise<Uint8Array | undefined> {
  const data = DATA_ADDRESS.exec(address);
  if (data?.[1] !== undefined) return Buffer.from(data[1], "base64");
  const url = URL.canParse(address) ? new URL(address) : undefined;
  if (url?.protocol !== "https:" || !GOOGLE_PHOTO_HOST.test(url.hostname)) return undefined;
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(TIME_LIMIT_MS) });
  if (response.status !== 200) throw new Error(`photo answered ${String(response.status)}`);
  return readLimited(response);
}

export function createProviderPhotoImporter({ users, storage, onProblem }: ProviderPhotoDependencies) {
  return async (userId: string): Promise<void> => {
    let avatarKey: string | undefined;
    try {
      const address = await users.providerImage(userId);
      const bytes = address === null ? undefined : await downloadProviderPhoto(address);
      if (bytes !== undefined) {
        const photo = await toAvatarWebp(bytes);
        const key = randomUUID();
        await storage.put(avatarStorageKey(userId, key), photo, "image/webp");
        avatarKey = key;
      }
    } catch (problem) {
      onProblem(problem);
    }
    await users.finishProviderPhoto(userId, avatarKey).catch(onProblem);
  };
}
