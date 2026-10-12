// The signed-in person's workspaces from GET /api/v1/me (F01 design.md section 11): asked every 30
// seconds and when the window regains focus, so renames, new members and removals reach an open app
// within a minute (AC-F01-23, 24).
import type { MeResponse } from "@meetapp/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, type ApiError } from "../api/index.ts";

export const ME_KEY = ["me"] as const;
const REFRESH_MS = 30_000;

export type MyWorkspace = MeResponse["workspaces"][number];

export function useMe() {
  return useQuery<MeResponse, ApiError>({
    queryKey: ME_KEY,
    queryFn: () => apiRequest<MeResponse>("/api/v1/me"),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}
