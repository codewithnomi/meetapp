// F17 (design.md 3.6; AC-F17-16): Sign out and Sign out everywhere leave the call first, so the others see
// the person go. Signing out always happens, even when leaving takes more than 5 s (a person must always
// be able to sign out); whatever is left of the call is cleared when the session changes (app/session-calls.ts).
import { useState } from "react";
import { inCallNow, leaveAndWait } from "../call-corner/index.ts";
import { useSignOut, useSignOutEverywhere } from "./session.ts";

function useLeavingFirst(signOut: { mutate: () => void; isPending: boolean }) {
  const [leaving, setLeaving] = useState(false);
  const mutate = () => {
    if (!inCallNow()) return signOut.mutate();
    setLeaving(true);
    void leaveAndWait().then(() => {
      setLeaving(false);
      signOut.mutate();
    });
  };
  return { mutate, isPending: signOut.isPending || leaving };
}

export const useSignOutLeavingFirst = () => useLeavingFirst(useSignOut());

export function useSignOutEverywhereLeavingFirst() {
  const everywhere = useSignOutEverywhere();
  return { ...useLeavingFirst(everywhere), error: everywhere.error };
}
