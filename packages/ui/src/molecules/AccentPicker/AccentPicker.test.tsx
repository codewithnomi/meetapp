// AccentPicker molecule tests: a named radio group of the 8 accent swatches in token order, swatch
// colors come from the accent tokens, one Tab stop with arrow keys (AC-F00-13, AC-F00-14).
import { ACCENTS, type Accent } from "@meetapp/design-tokens";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FOCUS_RING } from "../../lib/cx.ts";
import { AccentPicker } from "./AccentPicker.tsx";

// Sample text for the tests (the app passes translated strings from t("…") here).
const T = {
  accent: "Accent color",
  before: "Before",
  after: "After",
  labels: {
    sky: "Sky",
    blue: "Blue",
    purple: "Purple",
    pink: "Pink",
    red: "Red",
    orange: "Orange",
    green: "Green",
    teal: "Teal",
  } satisfies Record<Accent, string>,
};

function swatch(accent: Accent) {
  return screen.getByRole("radio", { name: T.labels[accent] });
}

function renderPicker(value: Accent, onChange: (value: Accent) => void = () => {}) {
  return render(<AccentPicker label={T.accent} labels={T.labels} value={value} onChange={onChange} />);
}

/** The picker is controlled; this wrapper keeps its state like a real screen would. */
function Controlled({ initial, onChange }: { initial: Accent; onChange: (value: Accent) => void }) {
  const [value, setValue] = useState<Accent>(initial);
  return (
    <>
      <button type="button">{T.before}</button>
      <AccentPicker
        label={T.accent}
        labels={T.labels}
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
      <button type="button">{T.after}</button>
    </>
  );
}

describe("AccentPicker", () => {
  it("TC-F00-27 [AC-F00-13] is a radio group named by its label with 8 named swatches in token order", () => {
    renderPicker("blue");
    expect(screen.getByRole("radiogroup", { name: "Accent color" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(8);
    expect(radios.map((r) => r.getAttribute("aria-label") ?? r.textContent)).toEqual(ACCENTS.map((a) => T.labels[a]));
    for (const r of radios) expect(r.tagName.toLowerCase()).toBe("button");
  });

  it.each([...ACCENTS])("TC-F00-27 [AC-F00-13] swatch %s uses its accent tokens and token classes", (accent) => {
    renderPicker("sky");
    const el = swatch(accent);
    expect(el.style.getPropertyValue("--sw")).toBe(`var(--accent-${accent})`);
    expect(el.style.getPropertyValue("--sw-on")).toBe(`var(--on-accent-${accent})`);
    expect(el).toHaveClass("bg-(--sw)", "text-(--sw-on)", "size-8.5", "rounded-full", ...FOCUS_RING.split(" "));
  });

  it("TC-F00-27 [AC-F00-13] only the checked swatch is aria-checked, ringed and shows the check icon", () => {
    renderPicker("green");
    for (const accent of ACCENTS) {
      const el = swatch(accent);
      const checked = accent === "green";
      expect(el).toHaveAttribute("aria-checked", String(checked));
      expect(el.classList.contains("ring-ink")).toBe(checked);
      expect(el.querySelector("svg") !== null).toBe(checked);
    }
    expect(swatch("green").querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("TC-F00-32 [AC-F00-14] roving tabindex: only the checked swatch is a Tab stop", () => {
    renderPicker("pink");
    expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual(ACCENTS.map((a) => (a === "pink" ? 0 : -1)));
  });

  it("TC-F00-32 [AC-F00-14] Tab enters on the checked swatch and the next Tab leaves the group", async () => {
    const user = userEvent.setup();
    render(<Controlled initial="orange" onChange={() => {}} />);
    await user.tab();
    await user.tab();
    expect(swatch("orange")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: T.after })).toHaveFocus();
  });

  it.each([
    ["{ArrowRight}", "sky", "blue"],
    ["{ArrowDown}", "sky", "blue"],
    ["{ArrowRight}", "teal", "sky"],
    ["{ArrowLeft}", "blue", "sky"],
    ["{ArrowUp}", "blue", "sky"],
    ["{ArrowLeft}", "sky", "teal"],
    ["{Home}", "green", "sky"],
    ["{End}", "purple", "teal"],
  ] as const)("TC-F00-32 [AC-F00-14] %s from %s focuses and selects %s", async (key, initial, next) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled initial={initial} onChange={onChange} />);
    await user.tab();
    await user.tab();
    await user.keyboard(key);
    expect(swatch(next)).toHaveFocus();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(next);
    expect(swatch(next)).toHaveAttribute("aria-checked", "true");
  });

  it.each([
    ["Space", " "],
    ["Enter", "{Enter}"],
  ])("TC-F00-32 [AC-F00-14] %s on a focused swatch selects it", async (_key, keys) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker("sky", onChange);
    swatch("red").focus();
    await user.keyboard(keys);
    expect(onChange).toHaveBeenCalledWith("red");
  });

  it("TC-F00-32 [AC-F00-14] clicking a swatch selects it", async () => {
    const onChange = vi.fn();
    renderPicker("sky", onChange);
    await userEvent.click(swatch("teal"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("teal");
  });

  it("TC-F00-27 [AC-F00-13] className is added to the group", () => {
    render(<AccentPicker label={T.accent} labels={T.labels} value="sky" onChange={() => {}} className="mt-2" />);
    expect(screen.getByRole("radiogroup")).toHaveClass("mt-2");
  });
});
