// IconButton atom tests: named by its label, pressed state, badge, sizes, tooltip, and state colors
// that override the variant (AC-F00-13, AC-F00-14).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "./IconButton.tsx";

// Sample text for the tests (the app passes translated strings from t("…") here).
const T = {
  mute: "Mute",
  unmute: "Unmute",
  stopSharing: "Stop sharing",
  more: "More options",
  participants: "Participants",
  raiseHand: "Raise hand",
  chat: "Chat",
};

const BORDER_COLORS = ["border-transparent", "border-line-strong"];
const BACKGROUNDS = ["bg-surface-raised", "bg-transparent", "bg-accent", "bg-danger-soft"];

function only(el: Element, allowed: string[]): string[] {
  return Array.from(el.classList).filter((c) => allowed.includes(c));
}

describe("IconButton", () => {
  it("TC-F00-32 [AC-F00-14] is a button whose accessible name is the label", () => {
    render(<IconButton icon="mic" label={T.mute} />);
    const button = screen.getByRole("button", { name: "Mute" });
    expect(button).toHaveAttribute("aria-label", "Mute");
    expect(button).toHaveAttribute("type", "button");
    // The icon inside is decorative; the label names the button.
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("TC-F00-32 [AC-F00-14] calls onClick when clicked and not when disabled", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<IconButton icon="mic" label={T.mute} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<IconButton icon="mic" label={T.mute} onClick={onClick} disabled />);
    await userEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("TC-F00-32 [AC-F00-14] aria-pressed is true when active", () => {
    render(<IconButton icon="screen" label={T.stopSharing} active />);
    expect(screen.getByRole("button", { name: "Stop sharing" })).toHaveAttribute("aria-pressed", "true");
  });

  it("TC-F00-32 [AC-F00-14] aria-pressed is true when off (microphone off is a pressed toggle)", () => {
    render(<IconButton icon="mic-off" label={T.unmute} off />);
    expect(screen.getByRole("button", { name: "Unmute" })).toHaveAttribute("aria-pressed", "true");
  });

  it("TC-F00-32 [AC-F00-14] aria-pressed is false when active/off are given as false", () => {
    render(<IconButton icon="mic" label={T.mute} active={false} off={false} />);
    expect(screen.getByRole("button", { name: "Mute" })).toHaveAttribute("aria-pressed", "false");
  });

  it("TC-F00-32 [AC-F00-14] aria-pressed is absent for a plain action button", () => {
    render(<IconButton icon="more" label={T.more} />);
    expect(screen.getByRole("button", { name: "More options" })).not.toHaveAttribute("aria-pressed");
  });

  it("TC-F00-27 [AC-F00-13] shows the badge count but hides it from screen readers", () => {
    render(<IconButton icon="users" label={T.participants} badge={12} />);
    const button = screen.getByRole("button", { name: "Participants" });
    const badge = screen.getByText("12");
    expect(button).toContainElement(badge);
    expect(badge).toBeVisible();
    expect(badge).toHaveAttribute("aria-hidden", "true");
  });

  it("TC-F00-27 [AC-F00-13] shows no badge when the count is 0 or missing", () => {
    const { rerender } = render(<IconButton icon="users" label={T.participants} badge={0} />);
    expect(screen.queryByText("0")).toBeNull();
    rerender(<IconButton icon="users" label={T.participants} />);
    expect(screen.getByRole("button").querySelector("[aria-hidden='true']:not(svg)")).toBeNull();
  });

  it("TC-F00-27 [AC-F00-13] md is 44px (size-11) and sm is 34px (size-8.5)", () => {
    const { rerender } = render(<IconButton icon="mic" label={T.mute} />);
    let button = screen.getByRole("button");
    expect(button).toHaveClass("size-11");
    expect(button).not.toHaveClass("size-8.5");
    expect(button.querySelector("svg")).toHaveAttribute("width", "22");
    rerender(<IconButton icon="mic" label={T.mute} size="sm" />);
    button = screen.getByRole("button");
    expect(button).toHaveClass("size-8.5");
    expect(button).not.toHaveClass("size-11");
    expect(button.querySelector("svg")).toHaveAttribute("width", "18");
  });

  it("TC-F00-33 [AC-F00-14] shows its label as a tooltip on keyboard focus", async () => {
    const user = userEvent.setup();
    render(<IconButton icon="hand" label={T.raiseHand} />);
    await user.tab();
    const button = screen.getByRole("button", { name: "Raise hand" });
    expect(button).toHaveFocus();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Raise hand");
  });

  it("TC-F00-33 [AC-F00-14] tooltip={false} renders no tooltip, even on focus", async () => {
    const user = userEvent.setup();
    render(<IconButton icon="hand" label={T.raiseHand} tooltip={false} />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Raise hand" })).toHaveFocus();
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("button")).not.toHaveAttribute("data-state");
  });

  it("TC-F00-27 [AC-F00-13] control variant: raised surface with a strong border", () => {
    render(<IconButton icon="mic" label={T.mute} />);
    const button = screen.getByRole("button");
    expect(only(button, BORDER_COLORS)).toEqual(["border-line-strong"]);
    expect(only(button, BACKGROUNDS)).toEqual(["bg-surface-raised"]);
  });

  it("TC-F00-27 [AC-F00-13] ghost variant: transparent with no visible border", () => {
    render(<IconButton icon="chat" label={T.chat} variant="ghost" />);
    const button = screen.getByRole("button");
    expect(only(button, BORDER_COLORS)).toEqual(["border-transparent"]);
    expect(only(button, BACKGROUNDS)).toEqual(["bg-transparent"]);
  });

  it.each(["control", "ghost"] as const)(
    "TC-F00-27 [AC-F00-13] active wins over the %s variant: accent fill, exactly one border color",
    (variant) => {
      render(<IconButton icon="screen" label={T.stopSharing} variant={variant} active />);
      const button = screen.getByRole("button");
      expect(only(button, BORDER_COLORS)).toEqual(["border-transparent"]);
      expect(only(button, BACKGROUNDS)).toEqual(["bg-accent"]);
      expect(button).toHaveClass("text-on-accent");
    },
  );

  it.each(["control", "ghost"] as const)(
    "TC-F00-27 [AC-F00-13] off wins over the %s variant: danger-soft fill, exactly one border color",
    (variant) => {
      render(<IconButton icon="mic-off" label={T.unmute} variant={variant} off />);
      const button = screen.getByRole("button");
      expect(only(button, BORDER_COLORS)).toEqual(["border-transparent"]);
      expect(only(button, BACKGROUNDS)).toEqual(["bg-danger-soft"]);
      expect(button).toHaveClass("text-danger");
    },
  );

  it("TC-F00-27 [AC-F00-13] passes extra props and classes through", () => {
    render(<IconButton icon="mic" label={T.mute} data-testid="mute" className="ml-2" />);
    expect(screen.getByTestId("mute")).toHaveClass("ml-2", "rounded-full");
  });
});
