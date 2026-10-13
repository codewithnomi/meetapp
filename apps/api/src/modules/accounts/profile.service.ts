// Profile: the name, the saved look and the photo (F01 design.md section 6; AC-F01-25, 26). A photo is
// checked from its content and re-encoded (avatar-image.ts) before it is stored privately under a new
// key; the old file is then deleted. Only the person and people who share a workspace with them can
// see it; everyone else gets the same 404 as for a photo that doesn't exist.
import { randomUUID } from "node:crypto";
import { AppError } from "../../plugins/errors.ts";
import { toAvatarWebp } from "./avatar-image.ts";
import type { ProfileRepository, SavedLook } from "./profile.repository.ts";
import { avatarStorageKey } from "./provider-photo.ts";

export interface PhotoStorage {
  put: (key: string, body: Uint8Array, contentType: string) => Promise<void>;
  get: (key: string) => Promise<Uint8Array>;
  delete: (key: string) => Promise<void>;
}

const PHOTO_RULE = "Use a JPEG, PNG or WebP image up to 5 MB.";
const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");

export function createProfileService(repository: ProfileRepository, storage: PhotoStorage) {
  const forget = async (userId: string, key: string | null) => {
    if (key) await storage.delete(avatarStorageKey(userId, key)).catch(() => undefined);
  };
  return {
    setName: (userId: string, name: string) => repository.setName(userId, name),
    setLook: (userId: string, look: SavedLook) => repository.setLook(userId, look),
    /** Stores the photo and answers its new address. */
    async setPhoto(userId: string, bytes: Uint8Array): Promise<{ photoUrl: string }> {
      const photo = await toAvatarWebp(bytes).catch(() => {
        throw new AppError(400, "PHOTO_INVALID", PHOTO_RULE);
      });
      const key = randomUUID();
      await storage.put(avatarStorageKey(userId, key), photo, "image/webp");
      await forget(userId, await repository.replaceAvatarKey(userId, key));
      return { photoUrl: `/api/v1/users/${userId}/avatar?v=${key}` };
    },
    async removePhoto(userId: string): Promise<void> {
      await forget(userId, await repository.replaceAvatarKey(userId, null));
    },
    async photo(viewerId: string, ownerId: string): Promise<Uint8Array> {
      const allowed = viewerId === ownerId || (await repository.shareAWorkspace(viewerId, ownerId));
      const key = allowed ? await repository.avatarKey(ownerId) : null;
      if (!key) throw notFound();
      return storage.get(avatarStorageKey(ownerId, key)).catch(() => {
        throw notFound();
      });
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
