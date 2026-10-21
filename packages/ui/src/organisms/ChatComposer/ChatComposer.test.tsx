// ChatComposer tests (F03 TC-F03-07, 28): the box and its tools are named; an empty box can't be sent;
// the Format toolbar shows every allowed kind of formatting. Typing, Enter, the counter and pasting are
// checked in the real app (tests/e2e/desktop/chat.spec.ts): jsdom can't drive a rich text editor.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatComposer } from "./ChatComposer.tsx";
import { SAMPLE_LABELS } from "./labels.ts";

const setup = () =>
  render(
    <ChatComposer
      labels={SAMPLE_LABELS}
      tooManyLabel={(n) => `${String(n)} too many`}
      onSend={vi.fn()}
      expressions={(_insert, close) => (
        <div>
          <button type="button">Inside</button>
          <button type="button" onClick={close}>
            Picker
          </button>
        </div>
      )}
    />,
  );

describe("ChatComposer", () => {
  it("[AC-F03-12] the smiley opens the emoji, GIF and sticker popup above the box; it can close itself", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: SAMPLE_LABELS.emoji }));
    await userEvent.click(screen.getByRole("button", { name: "Picker" }));
    expect(screen.queryByRole("button", { name: "Picker" })).not.toBeInTheDocument();
  });

  it("TC-F03-53 [AC-F03-28] Send waits while files are still uploading", () => {
    render(
      <ChatComposer
        labels={SAMPLE_LABELS}
        tooManyLabel={(n) => `${String(n)} too many`}
        onSend={vi.fn()}
        expressions={() => null}
        allowEmpty
        waiting
      />,
    );
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("a press inside the popup keeps it open; a press outside closes it (as in Teams)", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: SAMPLE_LABELS.emoji }));
    await userEvent.click(screen.getByRole("button", { name: "Inside" }));
    expect(screen.getByRole("button", { name: "Picker" })).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByRole("button", { name: "Picker" })).not.toBeInTheDocument();
  });

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
