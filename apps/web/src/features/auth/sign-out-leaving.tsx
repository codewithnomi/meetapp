// F17 (design.md 3.6; AC-F17-16): signing out during a call leaves the call first, so nobody stays in a
// call without a session. If leaving doesn't finish within 5 s, the person stays signed in and a banner
// says so (the call host draws it, as sign-out may come from a menu that has closed).
import { Notice } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { leaveCurrentCall, useCallCorner } from "../call-corner/index.ts";
import { useSignOut } from "./session.ts";

const useSignOutState = create<{ leaving: boolean; failed: boolean }>(() => ({ leaving: false, failed: false }));

export function useSignOutLeavingFirst() {
  const signOut = useSignOut();
  const leaving = useSignOutState((state) => state.leaving);
  const mutate = () => {
    useSignOutState.setState({ failed: false });
    if (!useCallCorner.getState().inCall) return signOut.mutate();
    useSignOutState.setState({ leaving: true });
    void leaveCurrentCall().then((left) => {
      useSignOutState.setState({ leaving: false, failed: !left });
      if (left) signOut.mutate();
    });
  };
  return { mutate, isPending: signOut.isPending || leaving };
}

export function SignOutFailedNotice() {
  const { t } = useTranslation();
  const failed = useSignOutState((state) => state.failed);
  if (!failed) return null;
  return (
    <div className="fixed top-4 left-1/2 z-40 w-[min(560px,calc(100%-32px))] -translate-x-1/2">
      <Notice
        tone="danger"
        action={{ label: t("meetings.call.dismiss"), onClick: () => useSignOutState.setState({ failed: false }) }}
      >
        {t("calls.leaveFirst.failed")}
      </Notice>
    </div>
  );
}
