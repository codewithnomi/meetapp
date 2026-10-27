// Why a camera or microphone isn't working, in words the pre-join screen can show (AC-F02-10): missing,
// in use by another app, or not allowed by the computer (with where to allow it). The person can still
// join without it.
export type MediaKind = "camera" | "microphone";
export type MediaProblem = "missing" | "busy" | "denied";

/** From the browser's error name and, on macOS and Windows, the system's own permission status. */
export function mediaProblem(errorName: string | undefined, systemStatus?: string): MediaProblem | undefined {
  if (systemStatus === "denied" || systemStatus === "restricted") return "denied";
  if (errorName === undefined) return undefined;
  if (errorName === "NotFoundError" || errorName === "OverconstrainedError") return "missing";
  if (errorName === "NotReadableError" || errorName === "AbortError") return "busy";
  if (errorName === "NotAllowedError" || errorName === "SecurityError") return "denied";
  return "busy";
}

export function problemKey(kind: MediaKind, problem: MediaProblem) {
  return `meetings.devices.problems.${kind}.${problem}` as const;
}
