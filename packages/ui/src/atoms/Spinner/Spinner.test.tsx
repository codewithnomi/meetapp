// Spinner atom tests: decorative without a label, announced as a status with one (AC-F00-13, AC-F00-14).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./Spinner.tsx";

// Sample text for the tests (the app passes translated strings from t("…") here).
const T = {
  connecting: "Connecting to the meeting",
  loading: "Loading",
};

describe("Spinner", () => {
  it("TC-F00-34 [AC-F00-14] without a label is aria-hidden and has no role", () => {
    const { container } = render(<Spinner />);
    const el = container.firstElementChild;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).not.toHaveAttribute("role");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("TC-F00-34 [AC-F00-14] with a label is a live status whose text is the label (what screen readers announce)", () => {
    render(<Spinner label={T.connecting} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Connecting to the meeting");
    expect(status).not.toHaveAttribute("aria-hidden");
  });

  it("TC-F00-34 [AC-F00-14] is not focusable", () => {
    const { container } = render(<Spinner label={T.loading} />);
    expect(container.firstElementChild).not.toHaveAttribute("tabindex");
  });

  it("TC-F00-27 [AC-F00-13] is 20px by default and applies a custom size", () => {
    const { container, rerender } = render(<Spinner />);
    expect(container.firstElementChild).toHaveStyle({ width: "20px", height: "20px" });
    rerender(<Spinner size={32} />);
    expect(container.firstElementChild).toHaveStyle({ width: "32px", height: "32px" });
  });

  it("TC-F00-27 [AC-F00-13] spins in the current text color and keeps extra classes", () => {
    const { container } = render(<Spinner className="text-accent-text" />);
    expect(container.firstElementChild).toHaveClass(
      "animate-[spin_0.8s_linear_infinite]",
      "border-current",
      "text-accent-text",
    );
  });
});
