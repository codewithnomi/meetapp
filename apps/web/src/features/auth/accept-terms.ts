// Accepting the Terms and the 16+ statement after a first Google/Microsoft sign-in (AC-F01-07): the
// screen's own call, with the token main adds. The answer is the signed-in person, now let in.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MeResponse } from "@meetapp/contracts";
import { apiRequest, type ApiError } from "../api/index.ts";
import { SESSION_KEY } from "./session.ts";

export function useAcceptTerms() {
  const queryClient = useQueryClient();
  return useMutation<MeResponse, ApiError>({
    mutationFn: () =>
      apiRequest<MeResponse>("/api/v1/me/terms", { method: "POST", body: { acceptTerms: true, ageConfirmed: true } }),
    onSuccess: (me) => queryClient.setQueryData(SESSION_KEY, me.user),
  });
}
