// Whether this MeetApp window is in front (F04 design 3.4): no card for what the person is already looking
// at. The desktop app says so whenever the window is shown, hidden, minimised, focused or left; the
// browser's own signals are used until it has (and in a browser). During a call the window runs at full
// speed, and then the browser keeps saying "visible" even when the window is hidden (desktop test).
type Bridge = { callWindows?: { onAction: (listener: (action: unknown) => void) => () => void } };

let told: boolean | undefined;
let watching = false;

function watch(): void {
  if (watching) return;
  watching = true;
  (window as { meetapp?: Bridge }).meetapp?.callWindows?.onAction((action) => {
    const front = action as { name?: string; on?: unknown };
    if (front.name === "windowFront" && typeof front.on === "boolean") told = front.on;
  });
}

/** True when the window is shown, not minimised, and has the keyboard. */
export function windowInFront(): boolean {
  watch();
  return told ?? (document.visibilityState === "visible" && document.hasFocus());
}
