// The calendar opens a meeting's details when asked from elsewhere (a reminder or invite card, F13).
import type { CalendarOccurrence } from "../../features/scheduling/index.ts";
import { useEffect, useRef } from "react";

export interface OpenOnLoad {
  meetingId: string;
  originalStart?: string | undefined;
}

/** Opens the asked-for meeting once it is in the calendar: that occurrence, or the series' first one. */
export function useOpenOnLoad(
  wanted: OpenOnLoad | undefined,
  occurrences: CalendarOccurrence[],
  setOpen: (o: CalendarOccurrence) => void,
) {
  const done = useRef<typeof wanted>(undefined);
  useEffect(() => {
    if (!wanted || done.current === wanted) return;
    const same = occurrences.filter((o) => o.meetingId === wanted.meetingId);
    const found = same.find((o) => o.originalStart === wanted.originalStart) ?? same[0];
    if (!found) return;
    done.current = wanted;
    setOpen(found);
  }, [wanted, occurrences, setOpen]);
}
