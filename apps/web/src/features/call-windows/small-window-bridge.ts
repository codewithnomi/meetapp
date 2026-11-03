// The small call window's side of the desktop bridge (F16 design.md section 1; D079): the state to show,
// button presses back, and the mini window's live-video pictures. Outside the desktop app there is no
// bridge, and the page shows nothing.
import type { CallWindowAction, CallWindowView } from "@meetapp/contracts";
import { useEffect, useState, type RefObject } from "react";

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

/**
 * Draws each live-video picture straight onto `canvas` and frees it at once (design.md 3.5): no picture
 * addresses pile up, so the mini window's memory stays flat during a long call. Clears it when stopped.
 */
export function useFrameCanvas(canvas: RefObject<HTMLCanvasElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let live = true;
    const stop = bridge()?.onFrame((frame) => {
      void createImageBitmap(new Blob([frame], { type: "image/jpeg" }))
        .then((picture) => {
          const target = canvas.current;
          if (live && target) {
            target.width = picture.width;
            target.height = picture.height;
            target.getContext("2d")?.drawImage(picture, 0, 0);
          }
          picture.close();
        })
        // A damaged picture is skipped; the next one comes 66 ms later.
        .catch(() => undefined);
    });
    return () => {
      live = false;
      stop?.();
    };
  }, [canvas, active]);
}
