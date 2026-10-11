// Tooltip atom tests: opens on keyboard focus, linked with aria-describedby, closes with Escape
// while focus stays on the trigger (TC-F00-33, AC-F00-14).
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button } from "../Button/index.ts";
import { Tooltip } from "./Tooltip.tsx";

// Sample text for the tests (the app passes translated strings from t("…") here).
const T = {
  copyLink: "Copy invite link",
  copy: "Copy",
  next: "Next",
};

function renderTooltip(open?: boolean) {
  return render(
    <Tooltip label={T.copyLink} {...(open === undefined ? {} : { open })}>
      <Button variant="secondary" icon="copy">
        {T.copy}
      </Button>
    </Tooltip>,
  );
}

describe("Tooltip", () => {
  it("TC-F00-33 [AC-F00-14] is hidden until the trigger gets focus or hover", () => {
    renderTooltip();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("TC-F00-33 [AC-F00-14] Tab to the button shows the tooltip, linked by aria-describedby", async () => {
    const user = userEvent.setup();
    renderTooltip();
    await user.tab();
    const button = screen.getByRole("button", { name: "Copy" });
    expect(button).toHaveFocus();
    // Radix renders the text twice: a visible copy and a visually hidden role=tooltip node that
    // screen readers use. The role=tooltip node is the one the button points at.
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Copy invite link");
    expect(tooltip.id).not.toBe("");
    expect(button.getAttribute("aria-describedby")?.split(" ")).toContain(tooltip.id);
    expect(button).toHaveAccessibleDescription("Copy invite link");
  });

  it("TC-F00-33 [AC-F00-14] Escape closes the tooltip and focus stays on the button", async () => {
    const user = userEvent.setup();
    renderTooltip();
    await user.tab();
    const button = screen.getByRole("button", { name: "Copy" });
    await screen.findByRole("tooltip");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    expect(button).toHaveFocus();
    expect(button).not.toHaveAttribute("aria-describedby");
  });

  it("TC-F00-33 [AC-F00-14] Tab away closes the tooltip", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Tooltip label={T.copyLink}>
          <Button>{T.copy}</Button>
        </Tooltip>
        <Button>{T.next}</Button>
      </>,
    );
    await user.tab();
    await screen.findByRole("tooltip");
    await user.tab();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("TC-F00-33 [AC-F00-14] open={true} shows the tooltip without focus", () => {
    renderTooltip(true);
    expect(screen.getByRole("button", { name: "Copy" })).not.toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Copy invite link");
  });

  it("TC-F00-33 [AC-F00-14] open={false} keeps it closed even on focus", async () => {
    const user = userEvent.setup();
    renderTooltip(false);
    await user.tab();
    expect(screen.getByRole("button", { name: "Copy" })).toHaveFocus();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("TC-F00-33 [AC-F00-14] the trigger itself stays the focusable element (no extra wrapper in the Tab order)", async () => {
    const user = userEvent.setup();
    const { container } = renderTooltip();
    await user.tab();
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(document.activeElement).toBe(container.querySelector("button"));
  });
});
