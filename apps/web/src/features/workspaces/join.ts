// The join link and code, asking to join, and deciding requests (AC-F01-19, 20). Lookups and requests
// are limited by the backend (20 an hour per person), so the app only asks when the person presses a
// button. Deciding a request refreshes the list and /me, so the side menu's count follows at once.
import type {
  joinLinkSchema,
  joinLookupResponseSchema,
  joinRequestResponseSchema,
  joinRequestsResponseSchema,
} from "@meetapp/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { apiRequest, type ApiError } from "../api/index.ts";
import { ME_KEY } from "./me.ts";
import { base, useWorkspaceQuery, workspaceKey } from "./people.ts";

type JoinLink = z.infer<typeof joinLinkSchema>;
export type JoinLookup = z.infer<typeof joinLookupResponseSchema>;
type JoinAnswer = z.infer<typeof joinRequestResponseSchema>;
export type JoinRequest = z.infer<typeof joinRequestsResponseSchema>["requests"][number];

export function useJoinLink(workspaceId: string) {
  return useWorkspaceQuery<JoinLink>(workspaceId, "join-link");
}

/** Turn on or off, or replace; the answer is the new state, shown at once. */
export function useJoinLinkChange(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation<JoinLink, ApiError, { kind: "toggle"; enabled: boolean } | { kind: "replace" }>({
    mutationFn: (change) =>
      change.kind === "replace"
        ? apiRequest(`${base(workspaceId)}/join-link/replace`, { method: "POST" })
        : apiRequest(`${base(workspaceId)}/join-link`, { method: "PUT", body: { enabled: change.enabled } }),
    onSuccess: (link) => queryClient.setQueryData(workspaceKey(workspaceId, "join-link"), link),
  });
}

export function useJoinLookup() {
  return useMutation<JoinLookup, ApiError, string>({
    mutationFn: (linkOrCode) => apiRequest("/api/v1/join/lookup", { method: "POST", body: { linkOrCode } }),
  });
}

export function useAskToJoin() {
  return useMutation<JoinAnswer, ApiError, string>({
    mutationFn: (linkOrCode) => apiRequest("/api/v1/join/request", { method: "POST", body: { linkOrCode } }),
  });
}

export function useJoinRequests(workspaceId: string) {
  return useWorkspaceQuery<{ requests: JoinRequest[] }>(workspaceId, "requests");
}

export function useDecideRequest(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation<undefined, ApiError, { id: string; decision: "approve" | "reject" }>({
    mutationFn: ({ id, decision }) =>
      apiRequest(`${base(workspaceId)}/requests/${encodeURIComponent(id)}/${decision}`, { method: "POST" }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKey(workspaceId, "requests") });
      void queryClient.invalidateQueries({ queryKey: ME_KEY, exact: true });
    },
  });
}
