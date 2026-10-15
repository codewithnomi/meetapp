// LobbyRow tests: Admit and Deny name the person for screen readers and report the choice (AC-F02-15,
// AC-F02-44).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LobbyRow } from "./LobbyRow.tsx";

const renderRow = (busy = false) => {
  const onAdmit = vi.fn();
  const onDeny = vi.fn();
  render(
    <ul>
      <LobbyRow
        name="Leo Martins (Guest)"
        admitText="Admit"
        denyText="Deny"
        admitLabel="Admit Leo Martins (Guest)"
        denyLabel="Deny Leo Martins (Guest)"
        onAdmit={onAdmit}
        onDeny={onDeny}
        busy={busy}
      />
    </ul>,
  );
  return { onAdmit, onDeny };
};

describe("LobbyRow", () => {
  it("TC-F02-86 [AC-F02-44] Admit and Deny name the person and work with the keyboard", async () => {
    const { onAdmit, onDeny } = renderRow();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Deny Leo Martins (Guest)" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(onDeny).toHaveBeenCalledTimes(1);
    expect(onAdmit).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-86 [AC-F02-44] while a decision is sent both buttons wait", () => {
    renderRow(true);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });
});
