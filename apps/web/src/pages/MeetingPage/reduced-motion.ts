// The computer's "reduce motion" setting (F03 AC-F03-25): GIFs start paused when it is on.
export const prefersReducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
