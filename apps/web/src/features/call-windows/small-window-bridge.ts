// The small call window's side of the desktop bridge (F16 design.md section 1; D079): the state to show,
// button presses back, and the mini window's live-video pictures. Outside the desktop app there is no
// bridge, and the page shows nothing.
import type { CallWindowAction, CallWindowView } from "@meetapp/contracts";
import { useEffect, useState } from "react";

interface SmallWindowBridge {
  onState: (listener: (view: unknown) => void) => () => void;
  act: (action: CallWindowAction) => void;
  onFrame: (listener: (frame: ArrayBuffer) => void) => () => void;
}

function bridge(): SmallWindowBridge | undefined {
  return (window as { meetappCallWindow?: SmallWindowBridge }).meetappCallWindow;
}

/** The latest view main sent; undefined until the first one. */
export function useSmallWindowView(): CallWindowView | undefined {
  const [view, setView] = useState<CallWindowView>();
  useEffect(() => bridge()?.onState((next) => setView(next as CallWindowView)), []);
  return view;
}

/** Sends a button press to main, which checks it and passes it on to the main window. */
export function act(action: CallWindowAction): void {
  bridge()?.act(action);
}

/** The latest live-video picture as a blob: address, freed when the next one arrives (design.md 3.5). */
export function useFrameUrl(): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let last: string | undefined;
    const stop = bridge()?.onFrame((frame) => {
      const next = URL.createObjectURL(new Blob([frame], { type: "image/jpeg" }));
      setUrl(next);
      if (last) URL.revokeObjectURL(last);
      last = next;
    });
    return () => {
      stop?.();
      if (last) URL.revokeObjectURL(last);
    };
  }, []);
  return url;
}
