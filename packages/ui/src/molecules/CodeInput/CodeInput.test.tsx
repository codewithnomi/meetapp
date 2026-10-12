// CodeInput molecule tests (F01 design.md section 2): six named boxes, typing moves on, Backspace moves
// back, pasting fills every box, only digits count, and the error is announced.
import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CodeInput } from "./CodeInput.tsx";

// Sample text for the tests (the app passes translated strings from t("…") here).
const digitLabel = (position: number, length: number) => `Digit ${String(position)} of ${String(length)}`;

function Harness({ onChange = vi.fn(), error }: { onChange?: (value: string) => void; error?: string }) {
  const [value, setValue] = useState("");
  return (
    <CodeInput
      id="code"
      label="Code"
      digitLabel={digitLabel}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      {...(error === undefined ? {} : { error })}
    />
  );
}

const box = (position: number) => screen.getByRole("textbox", { name: `Digit ${String(position)} of 6` });

describe("CodeInput", () => {
  it("TC-F01-14 [AC-F01-04] six boxes in a named group; typing moves to the next box", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByRole("group", { name: "Code" })).toBeInTheDocument();
    await userEvent.click(box(1));
    await userEvent.keyboard("4829");
    expect(onChange).toHaveBeenLastCalledWith("4829");
    expect(box(5)).toHaveFocus();
  });

  it("TC-F01-14 [AC-F01-04] letters are ignored; Backspace on an empty box moves back and deletes", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(box(1));
    await userEvent.keyboard("4a8");
    expect(onChange).toHaveBeenLastCalledWith("48");
    await userEvent.keyboard("{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith("4");
    expect(box(2)).toHaveFocus();
  });

  it("TC-F01-14 [AC-F01-04] pasting the code (even with spaces) fills every box", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.paste(box(1), { clipboardData: { getData: () => "482 913" } });
    expect(onChange).toHaveBeenLastCalledWith("482913");
    expect(box(6)).toHaveValue("3");
  });

  it("TC-F01-14 [AC-F01-04] an error marks every box and is linked for screen readers", () => {
    render(<Harness error="That code isn't right." />);
    expect(box(1)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("group", { name: "Code" })).toHaveAccessibleDescription("That code isn't right.");
  });
});
