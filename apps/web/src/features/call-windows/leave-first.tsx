// F17 "leave first" (design.md 3.5; AC-F17-09, 12): starting or joining something while in a call asks
// first, as one person is in one call at a time (no hold). Leave runs the call screen's own Leave, waits
// until the call is over (at most 5 s), then does the new thing; Cancel changes nothing.
import { Button, Dialog, Notice } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { inCallNow, leaveAndWait } from "../call-corner/index.ts";
import { useCurrentCall } from "../calls/index.ts";

type Kind = "start" | "join";

interface LeaveFirstState {
  ask: { kind: Kind; then: () => void } | undefined;
  leaving: boolean;
  failed: boolean;
  open: (kind: Kind, then: () => void) => void;
  close: () => void;
}

const useLeaveFirstState = create<LeaveFirstState>((set) => ({
  ask: undefined,
  leaving: false,
  failed: false,
  open: (kind, then) => set({ ask: { kind, then }, leaving: false, failed: false }),
  close: () => set({ ask: undefined, leaving: false, failed: false }),
}));

/** Runs `then` at once without a call; during one, asks first. */
export function useLeaveFirst(): (kind: Kind, then: () => void) => void {
  const open = useLeaveFirstState((state) => state.open);
  return (kind, then) => (inCallNow() ? open(kind, then) : then());
}

/** F17 pre-join (AC-F17-12): its own button says "Leave call and join", so it leaves without asking again.
 * Resolves false when leaving didn't finish within 5 s; `then` runs only after the call is over. */
export async function leaveCallAndRun(then: () => void): Promise<boolean> {
  const over = await leaveAndWait();
  if (over) then();
  return over;
}

/** Leaves the current call, then runs the waiting action; says so if leaving doesn't finish in 5 s. */
async function leaveThen(then: () => void): Promise<void> {
  const { close } = useLeaveFirstState.getState();
  useLeaveFirstState.setState({ leaving: true, failed: false });
  const over = await leaveCallAndRun(() => {
    close();
    then();
  });
  if (!over) useLeaveFirstState.setState({ leaving: false, failed: true });
}

/** The question itself; drawn once by the app (the call host). */
export function LeaveFirstDialog() {
  const { t } = useTranslation();
  const { ask, leaving, failed, close } = useLeaveFirstState();
  const call = useCurrentCall();
  if (!ask) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !leaving && close()}
      title={t(ask.kind === "start" ? "calls.leaveFirst.startTitle" : "calls.leaveFirst.joinTitle")}
      description={t(ask.kind === "start" ? "calls.leaveFirst.start" : "calls.leaveFirst.join", {
        title: call?.title ?? "",
      })}
      closeLabel={t("calls.leaveFirst.cancel")}
    >
      {failed ? <Notice tone="danger">{t("calls.leaveFirst.failed")}</Notice> : null}
      <div className="flex flex-wrap justify-end gap-2.5">
        <Button variant="ghost" disabled={leaving} onClick={close}>
          {t("calls.leaveFirst.cancel")}
        </Button>
        <Button variant="danger" disabled={leaving} onClick={() => void leaveThen(ask.then)}>
          {t(ask.kind === "start" ? "calls.leaveFirst.leaveStart" : "calls.leaveFirst.leaveJoin")}
        </Button>
      </div>
    </Dialog>
  );
}
