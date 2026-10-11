/** Joins class names, skipping empty ones: cx("a", false, "b") → "a b". */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}

/** The keyboard focus outline every interactive component shows (design system: 2px focus-ring, 2px offset). */
export const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
