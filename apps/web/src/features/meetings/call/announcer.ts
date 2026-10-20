// Things screen readers hear during a meeting (AC-F02-21, 44): joins and leaves, raised hands, "X muted
// you", the active speaker. One polite live region, at most one message every 2 seconds; when several
// arrive close together, they wait their turn (the newest of each kind wins).
import { useCallback, useEffect, useRef, useState } from "react";

const SPACING_MS = 2_000;

export function useAnnouncer() {
  const [current, setCurrent] = useState("");
  const queue = useRef(new Map<string, string>());
  useEffect(() => {
    const timer = setInterval(() => {
      const next = queue.current.entries().next();
      if (next.done) return;
      queue.current.delete(next.value[0]);
      setCurrent(next.value[1]);
    }, SPACING_MS);
    return () => clearInterval(timer);
  }, []);
  /** `kind` groups messages ("speaker", "join"…): a newer one of the same kind replaces the waiting one. */
  const announce = useCallback((kind: string, text: string) => {
    queue.current.set(kind, text);
  }, []);
  return { current, announce };
}
