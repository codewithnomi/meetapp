// ChatComposer tests (F03 TC-F03-07, 28): the box and its tools are named; an empty box can't be sent;
// the Format toolbar shows every allowed kind of formatting. Typing, Enter, the counter and pasting are
// checked in the real app (tests/e2e/desktop/chat.spec.ts): jsdom can't drive a rich text editor.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatComposer } from "./ChatComposer.tsx";
import { SAMPLE_EMOJI, SAMPLE_LABELS } from "./labels.ts";

const setup = () =>
  render(
    <ChatComposer
      labels={SAMPLE_LABELS}
      tooManyLabel={(n) => `${String(n)} too many`}
      onSend={vi.fn()}
      emoji={SAMPLE_EMOJI}
    />,
  );

describe("ChatComposer", () => {
  it("TC-F03-07 [AC-F03-03] [AC-F03-45] the box is named and an empty box can't be sent", () => {
    setup();
    expect(screen.getByRole("textbox", { name: "Message everyone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("TC-F03-28 [AC-F03-15] the Format toolbar offers every allowed kind of formatting", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Format" }));
    const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
    for (const name of [
      "Bold",
      "Italic",
      "Underline",
      "Strikethrough",
      "Bulleted list",
      "Numbered list",
      "Quote",
      "Inline code",
      "Code block",
      "Insert link",
    ]) {
      expect(toolbar.querySelector(`[aria-label="${name}"]`), name).not.toBeNull();
    }
  });
});
