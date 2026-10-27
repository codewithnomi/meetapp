// How call notes read (F15 AC-F15-15): "Sara started a call", "Call ended · 12m 30s" and "Missed call
// from Sara". Lengths read as 59s, 12m 30s, 1h 05m. All words come from the translation file.
import type { ChatMessageView } from "@meetapp/contracts";
import type { TFunction } from "i18next";

type Note = NonNullable<ChatMessageView["system"]>;

const pad = (value: number) => String(value).padStart(2, "0");

/** A call's length: under a minute in seconds, under an hour in minutes and seconds, then hours and minutes. */
export function durationText(t: TFunction, seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) return t("calls.duration.seconds", { s: total });
  if (total < 3600) return t("calls.duration.minutes", { m: Math.floor(total / 60), s: pad(total % 60) });
  return t("calls.duration.hours", { h: Math.floor(total / 3600), m: pad(Math.floor((total % 3600) / 60)) });
}

/** A call note's words, or undefined for any other note. */
export function callNoteText(t: TFunction, note: Note): string | undefined {
  if (note.event === "call_started") return t("calls.notes.started", { name: note.name });
  if (note.event === "call_ended") return t("calls.notes.ended", { duration: durationText(t, note.seconds ?? 0) });
  if (note.event === "call_missed") return t("calls.notes.missed", { name: note.name });
  return undefined;
}
