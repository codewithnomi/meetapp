// ReplyQuote tests (F03 TC-F03-26): the quote names the original and goes to it; in the message box it
// can be cancelled.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReplyQuote } from "./ReplyQuote.tsx";

describe("ReplyQuote", () => {
  it("TC-F03-26 [AC-F03-14] shows who and what, and goes to the original", async () => {
    const onShow = vi.fn();
    render(<ReplyQuote senderName="Bilal Ahmed" firstLine="Release checklist" onShow={onShow} />);
    await userEvent.click(screen.getByRole("button", { name: /Bilal Ahmed/ }));
    expect(onShow).toHaveBeenCalled();
  });

  it("TC-F03-26 [AC-F03-14] while writing a reply it can be cancelled", async () => {
    const onCancel = vi.fn();
    render(
      <ReplyQuote
        senderName="Bilal Ahmed"
        firstLine="Release checklist"
        composing={{ title: "Replying to Bilal Ahmed", cancelLabel: "Cancel reply", onCancel }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel reply" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
