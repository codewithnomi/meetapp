// Who is signed in, and the sign-in actions (F01 design.md sections 4 and 7). The session is asked from
// the desktop's main process every 30 seconds and when the window regains focus, so "signed out
// everywhere" reaches an open app within a minute (AC-F01-12). An action that signs in updates it at once.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authBridge, type AuthFailure, type AuthResult, type SignedInUser, type StepResult } from "./auth-bridge.ts";

export const SESSION_KEY = ["session"] as const;
const SESSION_REFRESH_MS = 30_000;

/** A refused action or session check, with the code the screen turns into a message. */
export class AuthError extends Error {
  readonly code: string;
  readonly retryAfterSeconds: number | undefined;

  constructor(failure: AuthFailure) {
    super(failure.code);
    this.name = "AuthError";
    this.code = failure.code;
    this.retryAfterSeconds = failure.retryAfterSeconds;
  }
}

/** The signed-in person; `null` when signed out; an AuthError (e.g. NETWORK_ERROR) when unknown. */
export function useSession() {
  return useQuery<SignedInUser | null, AuthError>({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const result = await authBridge().status();
      if (result.ok) return result.user;
      if (result.code === "SIGNED_OUT") return null;
      throw new AuthError(result);
    },
    retry: false,
    refetchInterval: SESSION_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}

/** Runs a sign-in step; a result with a user signs the app in. Failures arrive as AuthError. */
export function useAuthAction<Input, Result extends AuthResult | StepResult>(run: (input: Input) => Promise<Result>) {
  const queryClient = useQueryClient();
  return useMutation<Exclude<Result, AuthFailure>, AuthError, Input>({
    mutationFn: async (input) => {
      const result = await run(input);
      if (!result.ok) throw new AuthError(result);
      return result as Exclude<Result, AuthFailure>;
    },
    onSuccess: (result) => {
      if ("user" in result) queryClient.setQueryData(SESSION_KEY, result.user);
    },
  });
}

/** Signs this computer out at once (AC-F01-12). */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authBridge().signOut(),
    onSuccess: () => queryClient.setQueryData(SESSION_KEY, null),
  });
}
