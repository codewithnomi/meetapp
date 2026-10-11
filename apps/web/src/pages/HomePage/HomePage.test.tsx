// HomePage: the starter home screen (design.md section 6) and TC-F00-72/74 at component level (the demo
// element guarded by useFlag("demo") shows only while the flag is on).
import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage.tsx";

const API = "http://api.test";
const DEMO_TEXT = "Demo feature is on";

function flagsReply(enabled: boolean | "fail") {
  return vi.fn<typeof fetch>(async () => {
    if (enabled === "fail") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify([{ key: "demo", enabled }]), { status: 200 });
  });
}

function renderHome(fetcher: typeof fetch, onOpenSettings = vi.fn()) {
  render(<HomePage onOpenSettings={onOpenSettings} flagOptions={{ apiUrl: API, fetcher }} />);
  return onOpenSettings;
}

/** Waits until the flag reply has been handled. */
async function settle(fetcher: ReturnType<typeof flagsReply>) {
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

afterEach(() => vi.useRealTimers());

describe("HomePage", () => {
  it("TC-F00-16 [AC-F00-08] shows the MeetApp wordmark as the main heading and a welcome line", () => {
    renderHome(flagsReply(false));
    expect(screen.getByRole("heading", { level: 1, name: "MeetApp" })).toBeInTheDocument();
    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
  });

  it("TC-F00-16 [AC-F00-08] the Settings button opens Settings", async () => {
    const onOpenSettings = renderHome(flagsReply(false));
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("TC-F00-72 [AC-F00-34] the demo element shows when the demo flag is on", async () => {
    renderHome(flagsReply(true));
    expect(await screen.findByRole("status")).toHaveTextContent(DEMO_TEXT);
  });

  it("TC-F00-74 [AC-F00-34] the demo element is hidden while the flag is off", async () => {
    const fetcher = flagsReply(false);
    renderHome(fetcher);
    await settle(fetcher);
    expect(screen.queryByText(DEMO_TEXT)).not.toBeInTheDocument();
    // The status area stays (so screen readers announce it later) but is empty.
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("TC-F00-74 [AC-F00-34] the demo element is hidden when the flags cannot be fetched", async () => {
    const fetcher = flagsReply("fail");
    renderHome(fetcher);
    await settle(fetcher);
    expect(screen.queryByText(DEMO_TEXT)).not.toBeInTheDocument();
  });

  it("TC-F00-72 [AC-F00-34] switching the flag off hides the element at the next refresh, no reload", async () => {
    vi.useFakeTimers();
    let enabled = true;
    const fetcher = vi.fn<typeof fetch>(async () => {
      const reply = new Response(JSON.stringify([{ key: "demo", enabled }]));
      enabled = false;
      return reply;
    });
    renderHome(fetcher);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByRole("status")).toHaveTextContent(DEMO_TEXT);
    await act(() => vi.advanceTimersByTimeAsync(15_000));
    expect(screen.queryByText(DEMO_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "MeetApp" })).toBeInTheDocument();
  });
});
