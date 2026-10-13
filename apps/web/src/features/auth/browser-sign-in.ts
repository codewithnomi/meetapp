// The app's side of a Google/Microsoft sign-in (F01 design.md section 4): main opens the browser and
// answers with the 4-digit code; then the app waits for the browser. Started once per screen (even when
// React runs effects twice in development), and cancelled when the screen goes away.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { authBridge, type SignInProvider } from "./auth-bridge.ts";
import { SESSION_KEY } from "./session.ts";

export type BrowserSignIn =
  { step: "starting" } | { step: "waiting"; matchCode: string } | { step: "failed"; code: string };

export function useBrowserSignIn(provider: SignInProvider): BrowserSignIn {
  const queryClient = useQueryClient();
  const [state, setState] = useState<BrowserSignIn>({ step: "starting" });
  const started = useRef(false);
  const leaving = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(leaving.current);
    if (!started.current) {
      started.current = true;
      void (async () => {
        const begun = await authBridge().startProviderSignIn(provider);
        if (!begun.ok) return setState({ step: "failed", code: begun.code });
        setState({ step: "waiting", matchCode: begun.matchCode });
        const result = await authBridge().finishProviderSignIn();
        if (result.ok) queryClient.setQueryData(SESSION_KEY, result.user);
        else setState({ step: "failed", code: result.code });
      })();
    }
    // Leaving the screen cancels; React's development re-run clears this before it fires.
    return () => {
      leaving.current = setTimeout(() => void authBridge().cancelProviderSignIn(), 0);
    };
  }, [provider, queryClient]);

  return state;
}
