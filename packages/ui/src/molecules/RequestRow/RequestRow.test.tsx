// RequestRow tests (TC-F01-53, AC-F01-19, 28): the name, detail and badge show; each button reports its
// press and is described by the row's name; while busy nothing can be pressed.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RequestRow } from "./RequestRow.tsx";

function setUp(busy = false) {
  const approve = vi.fn();
  const reject = vi.fn();
  render(
    <RequestRow
      leading={{ person: "Zara Iqbal" }}
      title="Zara Iqbal"
      detail="zara@aria.com · asked 2 hours ago"
      badge="Removed earlier"
      busy={busy}
      actions={[
        { label: "Reject", variant: "ghost", onClick: reject },
        { label: "Approve", onClick: approve },
      ]}
    />,
  );
  return { approve, reject };
}

describe("RequestRow", () => {
  it("TC-F01-53 [AC-F01-19] shows the person, the detail and the badge; buttons report presses", async () => {
    const { approve, reject } = setUp();
    expect(screen.getByRole("img", { name: "Zara Iqbal" })).toBeInTheDocument();
    expect(screen.getByText("zara@aria.com · asked 2 hours ago")).toBeInTheDocument();
    expect(screen.getByText("Removed earlier")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(approve).toHaveBeenCalledTimes(1);
    expect(reject).toHaveBeenCalledTimes(1);
  });

  it("TC-F01-53 [AC-F01-28] each button is described by the row's name, for screen readers", () => {
    setUp();
    expect(screen.getByRole("button", { name: "Approve" })).toHaveAccessibleDescription("Zara Iqbal");
  });

  it("TC-F01-53 [AC-F01-29] while busy the buttons can't be pressed", () => {
    setUp(true);
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
  });

  it("TC-F01-53 [AC-F01-18] a workspace shows its initial, hidden from screen readers", () => {
    render(<RequestRow leading={{ workspace: "bayside", tone: "accent" }} title="bayside" detail="x" actions={[]} />);
    expect(screen.getByText("B")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
