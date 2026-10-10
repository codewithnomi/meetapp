// Button atom tests: variants use design tokens, loading/disabled can't be pressed, accessible names
// (AC-F00-13, AC-F00-14).
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, type ButtonSize, type ButtonVariant } from "./Button.tsx";

// Sample text for the tests (the app passes translated strings from t("…") here).
const T = {
  start: "Start meeting",
  go: "Go",
  save: "Save",
  copy: "Copy invite link",
  starting: "Starting meeting",
};

// Tailwind palette colors (bg-sky-500, text-white…) or raw hex/rgb/hsl values would bypass the tokens.
const PALETTE =
  /^(?:[\w-]+:)*(?:bg|text|border|outline|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d+)?(?:\/\d+)?$/;
const RAW_COLOR = /(?:#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\()/i;
const BORDER_COLORS = ["border-transparent", "border-line-strong"];

function classesOf(el: Element): string[] {
  return Array.from(el.classList);
}

const VARIANT_TOKENS: Record<ButtonVariant, string[]> = {
  primary: ["bg-accent", "text-on-accent", "border-transparent"],
  secondary: ["bg-surface", "text-ink", "border-line-strong"],
  ghost: ["bg-transparent", "text-accent-text", "border-transparent"],
  danger: ["bg-danger-fill", "text-on-danger-fill", "border-transparent"],
};

const SIZE_TOKENS: Record<ButtonSize, string[]> = {
  sm: ["h-8", "px-4"],
  md: ["h-10", "px-5"],
  lg: ["h-12", "px-6"],
};

describe("Button", () => {
  it("TC-F00-27 [AC-F00-13] renders a button named by its text, primary and md by default", () => {
    render(<Button>{T.start}</Button>);
    const button = screen.getByRole("button", { name: "Start meeting" });
    expect(button).toHaveClass(...VARIANT_TOKENS.primary, ...SIZE_TOKENS.md, "rounded-full");
  });

  it.each(Object.keys(VARIANT_TOKENS) as ButtonVariant[])(
    "TC-F00-27 [AC-F00-13] variant %s uses token classes, exactly one border color, no palette colors",
    (variant) => {
      render(<Button variant={variant}>{T.go}</Button>);
      const classes = classesOf(screen.getByRole("button"));
      expect(classes).toEqual(expect.arrayContaining(VARIANT_TOKENS[variant]));
      expect(classes.filter((c) => BORDER_COLORS.includes(c))).toHaveLength(1);
      expect(classes.filter((c) => PALETTE.test(c) || RAW_COLOR.test(c))).toEqual([]);
    },
  );

  it.each(Object.keys(SIZE_TOKENS) as ButtonSize[])(
    "TC-F00-27 [AC-F00-13] size %s sets its height and padding",
    (size) => {
      render(<Button size={size}>{T.go}</Button>);
      expect(screen.getByRole("button")).toHaveClass(...SIZE_TOKENS[size]);
    },
  );

  it("TC-F00-32 [AC-F00-14] calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>{T.start}</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Start meeting" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("TC-F00-32 [AC-F00-14] type defaults to button so it never submits a form by accident", () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>{T.go}</Button>
      </form>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "button");
    button.click();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("TC-F00-32 [AC-F00-14] type can be set to submit", () => {
    render(<Button type="submit">{T.save}</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("TC-F00-32 [AC-F00-14] disabled fires nothing on click", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        {T.start}
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Start meeting" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("TC-F00-27 [AC-F00-13] loading: disabled, aria-busy, spinner announced with loadingLabel, click does nothing", async () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel={T.starting} icon="mic" onClick={onClick}>
        {T.start}
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Start meeting/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    const status = within(screen.getByRole("button")).getByRole("status");
    expect(status).toHaveTextContent("Starting meeting");
    expect(button).toContainElement(status);
    // The icon is replaced by the spinner while loading.
    expect(button.querySelector("svg")).toBeNull();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("TC-F00-27 [AC-F00-13] loading requires loadingLabel; a JavaScript caller without it gets a decorative spinner", () => {
    // @ts-expect-error loadingLabel is required while loading (screen readers must hear what is happening)
    render(<Button loading>{T.start}</Button>);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("TC-F00-27 [AC-F00-13] not loading: no aria-busy and no spinner", () => {
    render(<Button>{T.start}</Button>);
    const button = screen.getByRole("button");
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).toBeEnabled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("TC-F00-34 [AC-F00-14] renders the icon (decorative) when not loading", () => {
    render(<Button icon="copy">{T.copy}</Button>);
    const button = screen.getByRole("button", { name: "Copy invite link" });
    const svg = button.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("TC-F00-27 [AC-F00-13] passes extra props and classes through", () => {
    render(
      <Button data-testid="start" aria-describedby="hint" className="w-full">
        {T.start}
      </Button>,
    );
    const button = screen.getByTestId("start");
    expect(button).toHaveAttribute("aria-describedby", "hint");
    expect(button).toHaveClass("w-full", "bg-accent");
  });
});
