// The workspace's own settings (F02 design.md section 2, item 5): its name (AC-F01-24) and the guest
// switch (AC-F02-40). Both are owner-and-admin changes; afterwards /me is fetched again, so the menu,
// the switcher and the page show the saved value.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, type ApiError } from "../api/index.ts";
import { ME_KEY } from "./me.ts";
import { base } from "./people.ts";

function useSaved<T>(send: (value: T) => Promise<undefined>) {
  const queryClient = useQueryClient();
  return useMutation<undefined, ApiError, T>({
    mutationFn: send,
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ME_KEY }),
  });
}

export function useRenameWorkspace(workspaceId: string) {
  return useSaved((name: string) => apiRequest<undefined>(base(workspaceId), { method: "PATCH", body: { name } }));
}

export function useAllowGuests(workspaceId: string) {
  return useSaved((allowGuests: boolean) =>
    apiRequest<undefined>(`${base(workspaceId)}/settings`, { method: "PATCH", body: { allowGuests } }),
  );
}
