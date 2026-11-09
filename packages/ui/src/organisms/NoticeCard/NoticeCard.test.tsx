// NoticeCard tests (TC-F04-51; AC-F04-30, 31, 33, 34): each kind shows its words, the × and only its own
// buttons; a message card opens its chat; the pointer on it is reported; it is announced without focus.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NoticeCard } from "./NoticeCard.tsx";

const close = () => ({ label: "Close", onClick: vi.fn() });

describe("NoticeCard", () => {
  it("TC-F04-51 [AC-F04-31] a message opens its chat; × closes; the pointer is reported", async () => {
    const open = { label: "Open the chat with Omar Farooq", onClick: vi.fn() };
    const x = close();
    const onHover = vi.fn();
    render(
      <NoticeCard
        kind="message"
        title="Omar Farooq"
        text="Hello"
        person={{ name: "Omar Farooq" }}
        open={open}
        close={x}
        onHover={onHover}
      />,
    );
    expect(screen.getByRole("status", { name: "Omar Farooq, Hello" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Admit" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Open the chat with Omar Farooq" }));
    expect(open.onClick).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(x.onClick).toHaveBeenCalledTimes(1);
    expect(onHover).toHaveBeenCalledWith(true);
    // Keyboard focus pauses it too, and leaving the card lets it go.
    (document.activeElement as HTMLElement).blur();
    onHover.mockClear();
    await userEvent.tab();
    expect(onHover).toHaveBeenLastCalledWith(true);
    await userEvent.tab();
    expect(onHover).not.toHaveBeenCalledWith(false);
    await userEvent.tab();
    expect(onHover).toHaveBeenLastCalledWith(false);
    expect(document.activeElement).not.toBe(document.body.firstChild);
  });

  it("TC-F04-51 [AC-F04-33] a mention is marked", () => {
    render(<NoticeCard kind="mention" title="Sara Malik" tag="mentioned you" text="@Olivia hi" close={close()} />);
    expect(screen.getByText("mentioned you")).toBeInTheDocument();
  });

  it("TC-F04-51 [AC-F04-34] the lobby has Admit and View lobby; a guest is marked", async () => {
    const admit = { label: "Admit", onClick: vi.fn() };
    const view = { label: "View lobby", onClick: vi.fn() };
    render(
      <NoticeCard
        kind="lobby"
        title="Lee Chen"
        tag="Guest"
        text="is waiting in the lobby"
        admit={admit}
        viewLobby={view}
        close={close()}
      />,
    );
    expect(screen.getByText("Guest")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Admit" }));
    await userEvent.click(screen.getByRole("button", { name: "View lobby" }));
    expect(admit.onClick).toHaveBeenCalledTimes(1);
    expect(view.onClick).toHaveBeenCalledTimes(1);
  });

  it("TC-F04-51 [AC-F04-30] still running has only ×; long names are cut, not wrapped", () => {
    render(<NoticeCard kind="running" title={"A".repeat(80)} text="In the menu bar" close={close()} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText("A".repeat(80))).toHaveClass("truncate");
  });
});
