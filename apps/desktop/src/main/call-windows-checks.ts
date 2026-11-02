// F16: checking what reaches the desktop app's main process (design.md 3.1; security review): a main
// window's report, entry by entry, and the saved window places. Without Electron, so they can be tested.
import type { CallWindowsState } from "@meetapp/contracts";

export interface Place {
  x: number;
  y: number;
  displayId: number;
}
export interface Places {
  ring?: Place;
  mini?: Place;
}

const short = (v: unknown, max = 200) => typeof v === "string" && v.length <= max;
// Photos only as PNG, JPEG or WebP pictures (no SVG; security review).
const isPhoto = (v: unknown) =>
  v === undefined || (short(v, 400_100) && /^data:image\/(png|jpeg|webp);base64,/.test(v as string));
const isPerson = (v: unknown) => {
  const p = v as Record<string, unknown> | null;
  return typeof p === "object" && p !== null && short(p["name"]) && short(p["initials"], 4) && isPhoto(p["photo"]);
};
const isKind = (v: unknown) => v === "video" || v === "audio";
const optional = (v: unknown) => v === undefined || short(v);

function isRing(v: unknown): boolean {
  const r = v as Record<string, unknown>;
  return (
    typeof r === "object" &&
    r !== null &&
    short(r["callId"], 100) &&
    isPerson(r["caller"]) &&
    isKind(r["kind"]) &&
    optional(r["chatName"]) &&
    optional(r["busyIn"])
  );
}
function isCall(v: unknown): boolean {
  if (v === null) return true;
  const c = v as Record<string, unknown>;
  const speaker = c?.["speaker"] as Record<string, unknown> | undefined;
  return (
    typeof c === "object" &&
    short(c["title"]) &&
    Number.isFinite(c["joinedAt"]) &&
    Number.isInteger(c["people"]) &&
    ["lobby", "calling", "in-call", "reconnecting"].includes(c["phase"] as string) &&
    isPerson(speaker) &&
    typeof speaker?.["hasVideo"] === "boolean" &&
    typeof speaker["sharing"] === "boolean" &&
    ["mic", "camera", "hand", "canUnmute", "canShare"].every((k) => typeof c[k] === "boolean")
  );
}
function isText(v: unknown): boolean {
  const t = v as Record<string, unknown> | null;
  return (
    typeof t === "object" && t !== null && short(t["title"], 60) && short(t["body"], 200) && short(t["callBack"], 40)
  );
}
function isMissed(v: unknown): boolean {
  const m = v as Record<string, unknown>;
  return (
    typeof m === "object" &&
    m !== null &&
    short(m["callId"], 100) &&
    short(m["from"]) &&
    optional(m["chatName"]) &&
    isKind(m["kind"]) &&
    short(m["conversationId"], 100) &&
    Number.isFinite(m["endedAt"]) &&
    isText(m["text"])
  );
}

/**
 * A main window's report, checked entry by entry before main uses it (design.md 3.1): a bad entry is left
 * out, never the whole report (bug review); at most 20 rings and 20 missed calls. Not a report: undefined.
 */
export function cleanReport(value: unknown): CallWindowsState | undefined {
  const s = value as Record<string, unknown> | null;
  if (typeof s !== "object" || s === null || !Array.isArray(s["rings"]) || !Array.isArray(s["missed"]))
    return undefined;
  return {
    rings: (s["rings"] as unknown[]).filter(isRing).slice(0, 20) as CallWindowsState["rings"],
    call: isCall(s["call"]) ? (s["call"] as CallWindowsState["call"]) : null,
    missed: (s["missed"] as unknown[]).filter(isMissed).slice(0, 20) as CallWindowsState["missed"],
  };
}

/** The saved places, keeping only well-formed entries (the file may have been edited by hand). */
export function validPlaces(value: unknown): Places {
  const places: Places = {};
  if (typeof value !== "object" || value === null) return places;
  for (const kind of ["ring", "mini"] as const) {
    const place = (value as Record<string, unknown>)[kind] as Record<string, unknown> | undefined;
    const ok = place && ["x", "y", "displayId"].every((key) => Number.isFinite(place[key]));
    if (ok) places[kind] = { x: Number(place["x"]), y: Number(place["y"]), displayId: Number(place["displayId"]) };
  }
  return places;
}
