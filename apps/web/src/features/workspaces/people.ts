// The member list and the changes to it (AC-F01-21, 22, 23). The list refreshes on the same 30-second
// rhythm as /me, so names, roles and removals are at most a minute old. A 404 means the person was
// removed meanwhile: /me is asked again at once, so the app moves them to Personal (AC-F01-23).
import type { MembersResponse } from "@meetapp/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiRequest, type ApiError } from "../api/index.ts";
import { ME_KEY } from "./me.ts";

const REFRESH_MS = 30_000;
export const base = (workspaceId: string) => `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`;
export const workspaceKey = (workspaceId: string, part: string) => ["workspaces", workspaceId, part] as const;

/** A query of this workspace's data; a 404 (no longer a member) asks /me again at once. */
export function useWorkspaceQuery<T>(workspaceId: string, part: string) {
  const queryClient = useQueryClient();
  const query = useQuery<T, ApiError>({
    queryKey: workspaceKey(workspaceId, part),
    queryFn: () => apiRequest<T>(`${base(workspaceId)}/${part}`),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const lostAccess = query.error?.status === 404;
  useEffect(() => {
    if (lostAccess) void queryClient.invalidateQueries({ queryKey: ME_KEY });
  }, [lostAccess, queryClient]);
  return query;
}

export function useMembers(workspaceId: string) {
  return useWorkspaceQuery<MembersResponse>(workspaceId, "members");
}

export type MemberChange = { kind: "promote" | "demote" | "remove" | "transfer"; userId: string } | { kind: "leave" };

function send(workspaceId: string, change: MemberChange): Promise<undefined> {
  if (change.kind === "leave") return apiRequest<undefined>(`${base(workspaceId)}/leave`, { method: "POST" });
  if (change.kind === "transfer") {
    return apiRequest<undefined>(`${base(workspaceId)}/transfer`, {
      method: "POST",
      body: { userId: change.userId, confirm: true },
    });
  }
  const member = `${base(workspaceId)}/members/${encodeURIComponent(change.userId)}`;
  if (change.kind === "remove") return apiRequest<undefined>(member, { method: "DELETE" });
  return apiRequest<undefined>(member, {
    method: "PATCH",
    body: { role: change.kind === "promote" ? "admin" : "member" },
  });
}

/** Role changes, removal, hand-over and leaving; afterwards the list and /me are fetched again. */
export function useMemberChange(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation<undefined, ApiError, MemberChange>({
    mutationFn: (change) => send(workspaceId, change),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKey(workspaceId, "members") });
      void queryClient.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}
