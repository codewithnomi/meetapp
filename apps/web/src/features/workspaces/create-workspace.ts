// Creating a company workspace (AC-F01-15). The request carries an Idempotency-Key, so a double click
// or a retry after a timeout makes one workspace (AC-F01-29). The new workspace is added to the list at
// once, so the app can switch to it straight away.
import type { MeResponse, WorkspaceSummary } from "@meetapp/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, type ApiError } from "../api/index.ts";
import { ME_KEY } from "./me.ts";

interface Created {
  workspace: WorkspaceSummary;
  switchTo: string;
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation<Created, ApiError, { name: string; key: string }>({
    mutationFn: ({ name, key }) =>
      apiRequest<Created>("/api/v1/workspaces", {
        method: "POST",
        body: { name },
        headers: { "idempotency-key": key },
      }),
    onSuccess: async ({ workspace }) => {
      // An older /me still on its way must not replace the list that now has the new workspace.
      await queryClient.cancelQueries({ queryKey: ME_KEY, exact: true });
      queryClient.setQueryData<MeResponse>(ME_KEY, (me) =>
        me ? { ...me, workspaces: [...me.workspaces, { ...workspace, pendingRequests: 0 }] } : me,
      );
      void queryClient.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}
