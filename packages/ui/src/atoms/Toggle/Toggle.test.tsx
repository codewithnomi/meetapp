// Toggle atom tests: a named switch that flips with click, Space and Enter, token classes, disabled
// does nothing (AC-F00-13, AC-F00-14).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FOCUS_RING } from "../../lib/cx.ts";
import { Toggle } from "./Toggle.tsx";

// Sample text for the tests (the app passes translated strings from t("…") here).
const T = {
  captions: "Live captions",
  description: "Show captions during meetings",
};

/** The Toggle is controlled; this wrapper keeps its state like a real screen would. */
function Controlled({ initial = false, onChange }: { initial?: boolean; onChange?: (next: boolean) => void }) {
  const [checked, setChecked] = useState(initial);
  return (
    <Toggle
      id="captions"
      label={T.captions}
      checked={checked}
      onChange={(next) => {
        onChange?.(next);
        setChecked(next);
      }}
    />
  );
}

describe("Toggle", () => {
  it("TC-F00-27 [AC-F00-13] is a switch named by its label, with id and token classes", () => {
    render(<Toggle id="captions" label={T.captions} checked={false} onChange={() => {}} />);
    const toggle = screen.getByRole("switch", { name: "Live captions" });
    expect(toggle).toHaveAttribute("id", "captions");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveClass(
      "rounded-full",
      "bg-surface-sunken",
      "border-line-strong",
      "data-[state=checked]:bg-accent",
      ...FOCUS_RING.split(" "),
    );
  });

  it.each([true, false])("TC-F00-27 [AC-F00-13] aria-checked reflects checked=%s", (checked) => {
    render(<Toggle id="captions" label={T.captions} checked={checked} onChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", String(checked));
  });

  it("TC-F00-27 [AC-F00-13] description is linked with aria-describedby", () => {
    render(<Toggle id="captions" label={T.captions} description={T.description} checked={false} onChange={() => {}} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-describedby", "captions-description");
    expect(document.getElementById("captions-description")).toHaveTextContent(T.description);
    expect(toggle).toHaveAccessibleDescription(T.description);
  });

  it("TC-F00-27 [AC-F00-13] without description: no aria-describedby", () => {
    render(<Toggle id="captions" label={T.captions} checked={false} onChange={() => {}} />);
    expect(screen.getByRole("switch")).not.toHaveAttribute("aria-describedby");
  });

  it("TC-F00-32 [AC-F00-14] click calls onChange with the opposite value once", async () => {
    const onChange = vi.fn();
    render(<Toggle id="captions" label={T.captions} checked onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("TC-F00-32 [AC-F00-14] clicking the label flips it too", async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.click(screen.getByText(T.captions));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it.each([
    ["Space", " "],
    ["Enter", "{Enter}"],
  ])("TC-F00-32 [AC-F00-14] Tab then %s flips the state, and again flips it back", async (_key, keys) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.tab();
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveFocus();
    await user.keyboard(keys);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(onChange).toHaveBeenLastCalledWith(true);
    await user.keyboard(keys);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("TC-F00-32 [AC-F00-14] disabled: skipped by Tab and onChange never fires", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <Toggle id="captions" label={T.captions} checked={false} disabled onChange={onChange} />
        <button type="button">after</button>
      </>,
    );
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeDisabled();
    await user.tab();
    expect(toggle).not.toHaveFocus();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
    await user.click(toggle);
    await user.click(screen.getByText(T.captions));
    expect(onChange).not.toHaveBeenCalled();
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("TC-F00-27 [AC-F00-13] className is applied", () => {
    const { container } = render(
      <Toggle id="captions" label={T.captions} checked={false} onChange={() => {}} className="mt-4" />,
    );
    expect(container.querySelector(".mt-4")).not.toBeNull();
  });
});
