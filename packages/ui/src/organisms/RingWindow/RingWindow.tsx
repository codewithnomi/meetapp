// RingWindow (organism): F16's small window for an incoming call above other apps (AC-F16-01–07, 21;
// approved canvas board "Calls while MeetApp isn't in front"). It is IncomingCall filling its own small
// window, with a hide × and a drag strip. It doesn't take focus when it appears (the person may be typing
// in another app); once they move to it, Tab reaches every button and Escape declines.
import { IncomingCall, type IncomingCallProps } from "../IncomingCall/index.ts";

export type RingWindowProps = Omit<IncomingCallProps, "takeFocus" | "standalone"> & {
  hide: NonNullable<IncomingCallProps["hide"]>;
};

export function RingWindow(props: RingWindowProps) {
  return <IncomingCall {...props} takeFocus={false} standalone />;
}
