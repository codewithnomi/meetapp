// Badge atom tests: tones use design tokens, optional decorative icon, never focusable
// (AC-F00-13, AC-F00-14).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge.tsx";

// Sample text for the tests (the app passes translated strings from t("…") here).
const T = {
  live: "Live",
  recording: "Recording",
};

// Tailwind palette colors (bg-sky-500, text-white…) or raw hex/rgb/hsl values would bypass the tokens.
const PALETTE =
  /^(?:[\w-]+:)*(?:bg|text|border|outline|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d+)?(?:\/\d+)?$/;
const RAW_COLOR = /(?:#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\()/i;

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";
const TONE_TOKENS: Record<BadgeTone, string[]> = {
  neutral: ["bg-surface-sunken", "text-ink-muted"],
  accent: ["bg-accent-soft", "text-accent-text"],
  success: ["bg-success-soft", "text-success"],
  warning: ["bg-warning-soft", "text-warning"],
  danger: ["bg-danger-soft", "text-danger"],
};
const TONES = Object.keys(TONE_TOKENS) as BadgeTone[];

describe("Badge", () => {
  it("TC-F00-27 [AC-F00-13] renders its text in a span, neutral by default", () => {
    render(<Badge>{T.live}</Badge>);
    const badge = screen.getByText(T.live).closest("span.rounded-sm");
    expect(badge).not.toBeNull();
    expect(badge).toHaveClass("h-5.5", ...TONE_TOKENS.neutral);
  });

  it.each(TONES)("TC-F00-27 [AC-F00-13] tone %s uses its token classes and no palette colors", (tone) => {
    const { container } = render(<Badge tone={tone}>{T.live}</Badge>);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.tagName.toLowerCase()).toBe("span");
    expect(badge).toHaveClass("rounded-sm", "h-5.5", ...TONE_TOKENS[tone]);
    const classes = Array.from(badge.classList);
    expect(classes.filter((c) => PALETTE.test(c) || RAW_COLOR.test(c))).toEqual([]);
    for (const other of TONES.filter((t) => t !== tone)) {
      const bg = TONE_TOKENS[other][0] as string;
      expect(badge).not.toHaveClass(bg);
    }
  });

  it("TC-F00-34 [AC-F00-14] icon is decorative", () => {
    const { container } = render(
      <Badge tone="danger" icon="signal">
        {T.recording}
      </Badge>,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("TC-F00-27 [AC-F00-13] without icon: no svg", () => {
    const { container } = render(<Badge>{T.live}</Badge>);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("TC-F00-34 [AC-F00-14] is not focusable and has no interactive role", () => {
    const { container } = render(<Badge>{T.live}</Badge>);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge).not.toHaveAttribute("tabindex");
    expect(badge).not.toHaveAttribute("role");
    badge.focus();
    expect(badge).not.toHaveFocus();
  });

  it("TC-F00-27 [AC-F00-13] className is added", () => {
    const { container } = render(<Badge className="ml-2">{T.live}</Badge>);
    expect(container.firstElementChild).toHaveClass("ml-2", "rounded-sm");
  });
});
