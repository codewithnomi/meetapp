// Counts down from `seconds` (restarting when `restartKey` changes), for "Code expires in 14:32".
import { useEffect, useState } from "react";

export function useCountdown(seconds: number, restartKey: number): number {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const endsAt = Date.now() + seconds * 1_000;
    setLeft(seconds);
    const timer = setInterval(() => setLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1_000))), 1_000);
    return () => clearInterval(timer);
  }, [seconds, restartKey]);
  return left;
}

/** 872 → "14:32" */
export const minutesAndSeconds = (seconds: number) =>
  `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, "0")}`;
