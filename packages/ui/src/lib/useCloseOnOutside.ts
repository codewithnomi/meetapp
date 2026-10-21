// Closes a popup when the person presses outside it (and outside the button that opens it, marked with
// the `data-expressions-button` attribute), as in Teams.
import { useEffect, type RefObject } from "react";

/** A press outside the popup (and outside its smiley button) closes it, as in Teams. */
export function useCloseOnOutside(open: boolean, popup: RefObject<HTMLDivElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const inside = popup.current?.contains(target) ?? false;
      const opener = (target as Element).closest?.("[data-expressions-button]") !== null;
      if (!inside && !opener) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, popup, close]);
}
