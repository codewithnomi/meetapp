// Changing one's own name and photo (AC-F01-25). Afterwards /me and the session are asked again, so the
// new name and photo show at once in this app; others see them on their next 30-second check. A photo
// that is too big or not JPEG/PNG/WebP is refused here before it is sent; the server checks again.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/index.ts";
import { SESSION_KEY } from "../auth/index.ts";
import { ME_KEY } from "../workspaces/index.ts";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const UPLOAD_TIME_LIMIT_MS = 60_000;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** The server's refusal of a photo, or the same refusal before sending (PHOTO_INVALID). */
export const isPhotoRefusal = (error: { code: string; status?: number } | null) =>
  error !== null && (error.code === "PHOTO_INVALID" || error.status === 413);

function useRefreshMe() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ME_KEY });
    void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
  };
}

export function useUpdateName() {
  const refresh = useRefreshMe();
  return useMutation<undefined, ApiError, string>({
    mutationFn: (name) => apiRequest("/api/v1/me", { method: "PATCH", body: { name } }),
    onSuccess: refresh,
  });
}

export function useUploadPhoto() {
  const refresh = useRefreshMe();
  return useMutation<{ photoUrl: string }, ApiError, File>({
    mutationFn: (file) => {
      if (file.size > MAX_PHOTO_BYTES || !PHOTO_TYPES.has(file.type)) {
        return Promise.reject(new ApiError("PHOTO_INVALID", 400));
      }
      // Up to 5 MB on a slow connection takes longer than the usual 10 seconds.
      return apiRequest("/api/v1/me/avatar", { method: "PUT", body: file, timeoutMs: UPLOAD_TIME_LIMIT_MS });
    },
    onSuccess: refresh,
  });
}

export function useRemovePhoto() {
  const refresh = useRefreshMe();
  return useMutation<undefined, ApiError>({
    mutationFn: () => apiRequest("/api/v1/me/avatar", { method: "DELETE" }),
    onSuccess: refresh,
  });
}
