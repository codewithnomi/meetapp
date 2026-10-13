// JoinLinkCard tests (TC-F01-53, AC-F01-19): managers get the switch and Replace; members only copy;
// copying puts the exact link or code on the clipboard and says "Copied"; off hides the secrets.
import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JoinLinkCard, type JoinLinkCardProps } from "./JoinLinkCard.tsx";

const LABELS = {
  title: "Join link and code",
  description: "Anyone signed in who has them can ask to join.",
  copyLink: "Copy link",
  copyCode: "Copy code",
  copied: "Copied",
  replace: "Replace link and code",
  off: "The join link is off.",
};
const LINK = "https://meetapp.app/join/abc";

function setUp(overrides: Partial<JoinLinkCardProps> = {}) {
  const handlers = { onToggle: vi.fn(), onReplace: vi.fn(), onCopy: vi.fn(() => Promise.resolve()) };
  render(<JoinLinkCard enabled link={LINK} code="AR4N7QXDKM" canManage labels={LABELS} {...handlers} {...overrides} />);
  return handlers;
}

describe("JoinLinkCard", () => {
  it("TC-F01-53 [AC-F01-19] shows the link and the code in two groups; copying gives the exact text", async () => {
    const { onCopy } = setUp();
    expect(screen.getByText(LINK)).toBeInTheDocument();
    expect(screen.getByText("AR4N7-QXDKM")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy code" }));
    expect(onCopy).toHaveBeenCalledWith("AR4N7QXDKM");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(onCopy).toHaveBeenLastCalledWith(LINK);
  });

  it("TC-F01-53 [AC-F01-19] 'Copied' goes back after two seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setUp();
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2100));
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("TC-F01-53 [AC-F01-19] the owner and admins switch it and replace it", async () => {
    const { onToggle, onReplace } = setUp();
    await userEvent.click(screen.getByRole("switch", { name: "Join link and code" }));
    expect(onToggle).toHaveBeenCalledWith(false);
    await userEvent.click(screen.getByRole("button", { name: "Replace link and code" }));
    expect(onReplace).toHaveBeenCalledTimes(1);
  });

  it("TC-F01-53 [AC-F01-19] members only copy: no switch, no Replace", () => {
    setUp({ canManage: false });
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replace link and code" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("TC-F01-53 [AC-F01-19] while off, nothing to copy; members read that it is off", () => {
    setUp({ canManage: false, enabled: false, link: null, code: null });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("The join link is off.")).toBeInTheDocument();
  });
});
