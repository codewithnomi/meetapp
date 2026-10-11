// Input atom tests: label, hint and error are linked for screen readers, token classes, keyboard
// typing, disabled is skipped by Tab (AC-F00-13, AC-F00-14).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./Input.tsx";

// Sample text for the tests (the app passes translated strings from t("…") here).
const T = {
  name: "Display name",
  hint: "Shown to people in your meetings",
  error: "Enter a name",
  search: "Search meetings",
  extra: "extra-help",
};

// Tailwind palette colors (bg-sky-500, text-white…) or raw hex/rgb/hsl values would bypass the tokens.
const PALETTE =
  /^(?:[\w-]+:)*(?:bg|text|border|outline|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d+)?(?:\/\d+)?$/;
const RAW_COLOR = /(?:#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\()/i;

describe("Input", () => {
  it("TC-F00-27 [AC-F00-13] is named by its label and uses token classes, no palette colors", () => {
    render(<Input id="name" label={T.name} />);
    const input = screen.getByRole("textbox", { name: "Display name" });
    expect(input).toHaveAttribute("id", "name");
    expect(input).toHaveClass("h-10", "rounded-full", "bg-surface-sunken", "border-line-strong", "text-ink");
    const classes = Array.from(input.classList);
    expect(classes.filter((c) => PALETTE.test(c) || RAW_COLOR.test(c))).toEqual([]);
  });

  it("TC-F00-32 [AC-F00-14] carries the focus-ring outline classes", () => {
    render(<Input id="name" label={T.name} />);
    expect(screen.getByRole("textbox")).toHaveClass("focus-visible:outline-2", "focus-visible:outline-focus-ring");
  });

  it("TC-F00-32 [AC-F00-14] takes focus with Tab and holds typed text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input id="name" label={T.name} onChange={onChange} />);
    await user.tab();
    const input = screen.getByRole("textbox", { name: "Display name" });
    expect(input).toHaveFocus();
    await user.keyboard("abc");
    expect(input).toHaveValue("abc");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("TC-F00-27 [AC-F00-13] without an error: no aria-invalid and no description", () => {
    render(<Input id="name" label={T.name} />);
    const input = screen.getByRole("textbox");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("TC-F00-27 [AC-F00-13] hint is linked with aria-describedby", () => {
    render(<Input id="name" label={T.name} hint={T.hint} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-describedby", "name-hint");
    expect(document.getElementById("name-hint")).toHaveTextContent(T.hint);
    expect(input).toHaveAccessibleDescription(T.hint);
  });

  it("TC-F00-27 [AC-F00-13] error: aria-invalid, linked message, danger border, replaces the hint", () => {
    render(<Input id="name" label={T.name} hint={T.hint} error={T.error} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "name-error");
    expect(document.getElementById("name-error")).toHaveTextContent(T.error);
    expect(input).toHaveAccessibleDescription(T.error);
    expect(input).toHaveClass("border-danger");
    expect(input).not.toHaveClass("border-line-strong");
    expect(document.getElementById("name-hint")).toBeNull();
    expect(screen.queryByText(T.hint)).toBeNull();
  });

  it("TC-F00-27 [AC-F00-13] keeps the caller's own aria-describedby before ours", () => {
    render(<Input id="name" label={T.name} hint={T.hint} aria-describedby={T.extra} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-describedby", `${T.extra} name-hint`);
  });

  it("TC-F00-34 [AC-F00-14] icon is decorative and makes room with left padding", () => {
    const { container } = render(<Input id="q" label={T.search} icon="search" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("textbox", { name: "Search meetings" })).toHaveClass("ps-10.5");
  });

  it("TC-F00-27 [AC-F00-13] without icon: no svg and no icon padding", () => {
    const { container } = render(<Input id="name" label={T.name} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByRole("textbox")).not.toHaveClass("ps-10.5");
  });

  it("TC-F00-32 [AC-F00-14] disabled: skipped by Tab and cannot be typed into", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Input id="name" label={T.name} disabled />
        <button type="button">after</button>
      </>,
    );
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
    await user.tab();
    expect(input).not.toHaveFocus();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
    await user.type(input, "abc");
    expect(input).toHaveValue("");
  });

  it("TC-F00-27 [AC-F00-13] className goes on the wrapper; other props reach the input", () => {
    const { container } = render(
      <Input id="name" label={T.name} className="mt-4" placeholder={T.name} data-testid="field" />,
    );
    const input = screen.getByTestId("field");
    expect(input.tagName.toLowerCase()).toBe("input");
    expect(input).toHaveAttribute("placeholder", T.name);
    expect(input).not.toHaveClass("mt-4");
    expect(container.firstElementChild).toHaveClass("mt-4");
  });

  it("TC-F00-27 [AC-F00-13] an Input must be named: a label, or an aria-label for an obvious field", () => {
    // @ts-expect-error without label or aria-label the field would have no accessible name
    render(<Input id="unnamed" />);
    render(<Input id="q" aria-label={T.search} icon="search" />);
    expect(screen.getByRole("textbox", { name: T.search })).toBeInTheDocument();
  });
});
