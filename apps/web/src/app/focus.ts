// After a screen change, keyboard and screen-reader users land on the new screen's title (F01 design.md
// section 1). Never into a call hidden behind the screen (F17, AC-F17-18): it is inert, so focus put there
// would be lost.
import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

export const SCREEN_TITLE = "main:not([data-call-host][hidden] *) h1";

export function useFocusOnScreenChange(): void {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.querySelector<HTMLElement>(SCREEN_TITLE)?.focus();
  }, [pathname]);
}
