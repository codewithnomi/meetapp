// Email invitations (AC-F01-17, 18). Sending: one call per address, one after the other, so each gets
// its own answer ("<email> is already a member"); the daily limit stops the rest. The pending list and
// the signed-in person's own invitations refresh every 30 seconds like the rest of the workspace data.
import type {
  invitationAcceptedSchema,
  MeResponse,
  myInvitationsResponseSchema,
  sentInvitationsResponseSchema,
} from "@meetapp/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { apiRequest, ApiError } from "../api/index.ts";
import { ME_KEY } from "./me.ts";
import { base, useWorkspaceQuery, workspaceKey } from "./people.ts";

export type SentInvitation = z.infer<typeof sentInvitationsResponseSchema>["invitations"][number];
export type MyInvitation = z.infer<typeof myInvitationsResponseSchema>["invitations"][number];
type Accepted = z.infer<typeof invitationAcceptedSchema>;

export function useSentInvitations(workspaceId: string) {
  return useWorkspaceQuery<{ invitations: SentInvitation[] }>(workspaceId, "invitations");
}

/** What happened to each address: sent, or refused with the backend's code. */
export interface InviteOutcome {
  sent: string[];
  refused: { email: string; code: string }[];
}

async function inviteEach(workspaceId: string, emails: string[], role: "admin" | "member"): Promise<InviteOutcome> {
  const outcome: InviteOutcome = { sent: [], refused: [] };
  for (const [index, email] of emails.entries()) {
    try {
      await apiRequest(`${base(workspaceId)}/invitations`, { method: "POST", body: { email, role } });
      outcome.sent.push(email);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "NETWORK_ERROR";
      // Over the daily limit or offline: the rest would fail the same way, so they stay unsent.
      if (code === "TOO_MANY_ATTEMPTS" || code === "NETWORK_ERROR") {
        outcome.refused.push(...emails.slice(index).map((rest) => ({ email: rest, code })));
        break;
      }
      outcome.refused.push({ email, code });
    }
  }
  return outcome;
}

export function useInvite(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation<InviteOutcome, ApiError, { emails: string[]; role: "admin" | "member" }>({
    mutationFn: ({ emails, role }) => inviteEach(workspaceId, emails, role),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: workspaceKey(workspaceId, "invitations") }),
  });
}

/** Cancel or "Send again" (a new link and email; the old link stops). */
export function useInvitationAction(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, { kind: "cancel" | "resend"; id: string }>({
    mutationFn: ({ kind, id }) => {
      const path = `${base(workspaceId)}/invitations/${encodeURIComponent(id)}`;
      return kind === "cancel"
        ? apiRequest(path, { method: "DELETE" })
        : apiRequest(`${path}/resend`, { method: "POST" });
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: workspaceKey(workspaceId, "invitations") }),
  });
}

const MINE_KEY = ["me", "invitations"] as const;

export function useMyInvitations() {
  return useQuery<{ invitations: MyInvitation[] }, ApiError>({
    queryKey: MINE_KEY,
    queryFn: () => apiRequest("/api/v1/me/invitations"),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Join or Decline. Joining adds the workspace to the list at once, so the app can open it. */
export function useAnswerInvitation() {
  const queryClient = useQueryClient();
  return useMutation<Accepted | undefined, ApiError, { kind: "accept" | "decline"; id: string }>({
    mutationFn: ({ kind, id }) =>
      apiRequest(`/api/v1/invitations/${encodeURIComponent(id)}/${kind}`, { method: "POST", body: {} }),
    onSuccess: async (accepted) => {
      if (accepted) {
        // An older /me still on its way must not replace the list that now has the new workspace.
        await queryClient.cancelQueries({ queryKey: ME_KEY, exact: true });
        queryClient.setQueryData<MeResponse>(ME_KEY, (me) =>
          me && !me.workspaces.some((w) => w.id === accepted.workspace.id)
            ? { ...me, workspaces: [...me.workspaces, { ...accepted.workspace, pendingRequests: 0 }] }
            : me,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: MINE_KEY });
      void queryClient.invalidateQueries({ queryKey: ME_KEY, exact: true });
    },
  });
}
