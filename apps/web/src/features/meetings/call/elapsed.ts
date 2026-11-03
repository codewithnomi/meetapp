// The time in the meeting shown on the control bar ("00:18:42"), counted from entering.
import { useEffect, useState } from "react";

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const parts = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

/** Counted from now, or from `since` (ms since 1970; F16's mini window counts from joining). */
export function useElapsed(since?: number): string {
  const [start] = useState(() => since ?? Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return clock(now - start);
}
