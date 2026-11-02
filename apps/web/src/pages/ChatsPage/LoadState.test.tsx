// Loading and error states of the chat panes (F14 T-fix-4): a spinner while loading, the reason with
// Retry after a failure, nothing once the data is there (a later failed reload keeps the screen).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoadState, showsLoadState } from "./LoadState.tsx";

const query = (over: Partial<{ data: unknown; isPending: boolean; isError: boolean }> = {}) => ({
  data: undefined,
  isPending: false,
  isError: false,
  refetch: vi.fn(),
  ...over,
});

describe("chat pane load states", () => {
  it("TC-F14-01 [AC-F14-01] a spinner with its label while loading", () => {
    render(<LoadState query={query({ isPending: true })} loadingLabel="Loading chats…" />);
    expect(screen.getByText("Loading chats…")).toBeInTheDocument();
  });

  it("TC-F14-01 [AC-F14-01] after a failure: the reason and Retry, which loads again", async () => {
    const failed = query({ isError: true });
    render(<LoadState query={failed} loadingLabel="Loading chats…" />);
    expect(screen.getByText(/Couldn't load this/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(failed.refetch).toHaveBeenCalledOnce();
  });

  it("TC-F14-01 [AC-F14-01] nothing once loaded, even when a later reload fails", () => {
    const loaded = query({ data: { conversations: [] }, isError: true });
    const { container } = render(<LoadState query={loaded} loadingLabel="Loading chats…" />);
    expect(container).toBeEmptyDOMElement();
    expect(showsLoadState(loaded)).toBe(false);
    expect(showsLoadState(query({ isPending: true }))).toBe(true);
  });
});
