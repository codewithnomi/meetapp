// Icon atom tests: decorative by default, named when it carries meaning (AC-F00-13, AC-F00-14).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "./Icon.tsx";
import { ICON_NAMES } from "./icons.ts";

// Sample text for the tests (the app passes translated strings from t("…") here).
const T = {
  muted: "Muted",
  microphone: "Microphone",
};

describe("Icon", () => {
  it("TC-F00-34 [AC-F00-14] is decorative by default: aria-hidden and no role", () => {
    const { container } = render(<Icon name="mic" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
    expect(svg).not.toHaveAttribute("aria-label");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("TC-F00-34 [AC-F00-14] with a label has role img and that accessible name", () => {
    render(<Icon name="mic-off" label={T.muted} />);
    const img = screen.getByRole("img", { name: "Muted" });
    expect(img.tagName.toLowerCase()).toBe("svg");
    expect(img).not.toHaveAttribute("aria-hidden");
  });

  it("TC-F00-34 [AC-F00-14] is never focusable", () => {
    const { container } = render(<Icon name="mic" label={T.microphone} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).not.toHaveAttribute("tabindex");
  });

  it.each(ICON_NAMES)("TC-F00-27 [AC-F00-13] renders an svg for icon %s", (name) => {
    const { container } = render(<Icon name={name} />);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("TC-F00-27 [AC-F00-13] uses size 20 by default and applies a custom size", () => {
    const { container, rerender } = render(<Icon name="mic" />);
    let svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "20");
    expect(svg).toHaveAttribute("height", "20");
    rerender(<Icon name="mic" size={32} />);
    svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("height", "32");
  });

  it("TC-F00-27 [AC-F00-13] draws with stroke width 1.75 (design system line weight)", () => {
    const { container } = render(<Icon name="calendar" />);
    expect(container.querySelector("svg")).toHaveAttribute("stroke-width", "1.75");
  });

  it("TC-F00-27 [AC-F00-13] keeps extra classes alongside its own", () => {
    const { container } = render(<Icon name="mic" className="text-danger" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("text-danger", "block", "shrink-0");
  });
});
