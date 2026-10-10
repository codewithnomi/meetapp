// SegmentedControl molecule tests: a named radio group, one Tab stop (roving tabindex), arrow keys
// move and select with wrap-around, Home/End, token classes (AC-F00-13, AC-F00-14).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FOCUS_RING } from "../../lib/cx.ts";
import { SegmentedControl } from "./SegmentedControl.tsx";

// Sample text for the tests (the app passes translated strings from t("…") here).
const T = {
  theme: "Theme",
  light: "Light",
  dark: "Dark",
  system: "System",
  before: "Before",
  after: "After",
};

type Mode = "light" | "dark" | "system";
const OPTIONS: { value: Mode; label: string; icon?: "sun" | "moon" | "monitor" }[] = [
  { value: "light", label: T.light, icon: "sun" },
  { value: "dark", label: T.dark, icon: "moon" },
  { value: "system", label: T.system, icon: "monitor" },
];

/** The control is controlled; this wrapper keeps its state like a real screen would. */
function Controlled({ initial, onChange }: { initial: Mode; onChange: (value: Mode) => void }) {
  const [value, setValue] = useState<Mode>(initial);
  return (
    <>
      <button type="button">{T.before}</button>
      <SegmentedControl
        label={T.theme}
        options={OPTIONS}
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

function radio(name: string) {
  return screen.getByRole("radio", { name });
}

async function setup(initial: Mode = "light") {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Controlled initial={initial} onChange={onChange} />);
  await user.tab();
  await user.tab();
  return { user, onChange };
}

describe("SegmentedControl", () => {
  it("TC-F00-27 [AC-F00-13] is a radio group named by its label with one radio per option", () => {
    render(<SegmentedControl label={T.theme} options={OPTIONS} value="dark" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual([T.light, T.dark, T.system]);
    for (const r of radios) expect(r.tagName.toLowerCase()).toBe("button");
    expect(radio("Dark")).toHaveAttribute("aria-checked", "true");
    expect(radio("Light")).toHaveAttribute("aria-checked", "false");
  });

  it("TC-F00-27 [AC-F00-13] checked option is raised, others muted; every option has the focus ring", () => {
    render(<SegmentedControl label={T.theme} options={OPTIONS} value="dark" onChange={() => {}} />);
    expect(radio("Dark")).toHaveClass("bg-surface-raised", "text-ink", "shadow-1");
    for (const name of ["Light", "System"]) {
      expect(radio(name)).toHaveClass("text-ink-muted");
      expect(radio(name)).not.toHaveClass("bg-surface-raised");
    }
    for (const r of screen.getAllByRole("radio")) expect(r).toHaveClass(...FOCUS_RING.split(" "));
  });

  it("TC-F00-34 [AC-F00-14] option icons are decorative", () => {
    const { container } = render(
      <SegmentedControl label={T.theme} options={OPTIONS} value="dark" onChange={() => {}} />,
    );
    const svgs = Array.from(container.querySelectorAll("svg"));
    expect(svgs).toHaveLength(3);
    for (const svg of svgs) expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it.each([
    ["dark", [-1, 0, -1]],
    ["unknown", [0, -1, -1]],
  ])("TC-F00-32 [AC-F00-14] roving tabindex with value %s", (value, tabIndexes) => {
    render(<SegmentedControl label={T.theme} options={OPTIONS} value={value as Mode} onChange={() => {}} />);
    expect(screen.getAllByRole("radio").map((r) => r.tabIndex)).toEqual(tabIndexes);
  });

  it("TC-F00-32 [AC-F00-14] Tab enters on the checked option and the next Tab leaves the group", async () => {
    const { user } = await setup("system");
    expect(radio("System")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: T.after })).toHaveFocus();
    await user.tab({ shift: true });
    expect(radio("System")).toHaveFocus();
  });

  it.each([
    ["{ArrowRight}", "light", "Dark", "dark"],
    ["{ArrowDown}", "light", "Dark", "dark"],
    ["{ArrowRight}", "system", "Light", "light"],
    ["{ArrowLeft}", "dark", "Light", "light"],
    ["{ArrowUp}", "dark", "Light", "light"],
    ["{ArrowLeft}", "light", "System", "system"],
    ["{Home}", "system", "Light", "light"],
    ["{End}", "light", "System", "system"],
  ] as const)(
    "TC-F00-32 [AC-F00-14] %s from %s focuses and selects %s",
    async (key, initial, focusedName, selected) => {
      const { user, onChange } = await setup(initial);
      await user.keyboard(key);
      expect(radio(focusedName)).toHaveFocus();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(selected);
      expect(radio(focusedName)).toHaveAttribute("aria-checked", "true");
      expect(radio(focusedName).tabIndex).toBe(0);
    },
  );

  it.each([
    ["Space", " "],
    ["Enter", "{Enter}"],
  ])("TC-F00-32 [AC-F00-14] %s on a focused option selects it", async (_key, keys) => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SegmentedControl label={T.theme} options={OPTIONS} value="light" onChange={onChange} />);
    radio("System").focus();
    await user.keyboard(keys);
    expect(onChange).toHaveBeenCalledWith("system");
  });

  it("TC-F00-32 [AC-F00-14] clicking an option selects it", async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label={T.theme} options={OPTIONS} value="light" onChange={onChange} />);
    await userEvent.click(radio("Dark"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("dark");
  });

  it("TC-F00-27 [AC-F00-13] className is added to the group", () => {
    render(<SegmentedControl label={T.theme} options={OPTIONS} value="light" onChange={() => {}} className="w-full" />);
    expect(screen.getByRole("radiogroup")).toHaveClass("w-full");
  });

  it("TC-F00-32 [AC-F00-14] in a right-to-left layout ArrowLeft moves forward and ArrowRight back", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <div dir="rtl">
        <Controlled initial="light" onChange={onChange} />
      </div>,
    );
    await user.tab();
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(radio(T.dark)).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("dark");
    await user.keyboard("{ArrowRight}");
    expect(radio(T.light)).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("light");
  });
});
