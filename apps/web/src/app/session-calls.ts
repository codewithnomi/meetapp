// F17 (security review, AC-F17-16): a call belongs to the person signed in when it started. Whenever that
// changes, any way (Sign out, Sign out everywhere, a session that ended or was ended on another device,
// someone else signing in), the call is left (best effort) and every trace of it is cleared from memory:
// the visit and its meeting ticket, the chat call, an ended call's outcome, the call screen's state. Until
// that is done the app shows its waiting screen, so no screen ever shows the old call to the new person.
import { useLayoutEffect, useState } from "react";
import { useCallCorner } from "../features/call-corner/index.ts";
import { useCallScreen } from "../features/call-windows/index.ts";
import { useCallOutcome, useChatCall } from "../features/calls/index.ts";
import { leaveMeeting, useVisit } from "../features/meetings/index.ts";

function clearCalls(): void {
  void leaveMeeting(useVisit.getState().visit);
  useVisit.getState().end();
  useChatCall.setState({ call: undefined, left: undefined, backTo: undefined });
  useCallOutcome.getState().clear();
  useCallScreen.getState().clear();
  useCallCorner.getState().set(false);
}

/** False while the calls of the person who was signed in are being cleared. */
export function useCallsFollowSession(userId: string | undefined): boolean {
  const [owner, setOwner] = useState(userId);
  useLayoutEffect(() => {
    if (owner === userId) return;
    clearCalls();
    setOwner(userId);
  }, [owner, userId]);
  return owner === userId;
}
