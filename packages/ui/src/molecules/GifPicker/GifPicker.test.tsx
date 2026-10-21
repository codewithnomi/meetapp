// GifPicker tests (F03 TC-F03-44, 49): search words reach the page, results are picked, the first-time
// notice and the "not available" message show.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GifPicker, type GifPickerProps } from "./GifPicker.tsx";

const BASE: GifPickerProps = {
  query: "",
  onQuery: vi.fn(),
  results: [{ id: "1", url: "https://static.klipy.com/a.gif", description: "GIF: waving cat", width: 100, height: 80 }],
  status: "ready",
  onPick: vi.fn(),
  reduceMotion: false,
  labels: {
    search: "Search GIFs",
    loading: "Searching…",
    unavailable: "GIFs aren't available",
    attribution: "Powered by KLIPY",
  },
};

describe("GifPicker", () => {
  it("TC-F03-44 [AC-F03-24] typing searches and pressing a result picks it", async () => {
    const onQuery = vi.fn();
    const onPick = vi.fn();
    render(<GifPicker {...BASE} onQuery={onQuery} onPick={onPick} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search GIFs" }), "c");
    expect(onQuery).toHaveBeenCalledWith("c");
    await userEvent.click(screen.getByRole("button", { name: "GIF: waving cat" }));
    expect(onPick).toHaveBeenCalledWith(BASE.results[0]);
  });

  it("TC-F03-49 [AC-F03-27] the first-time notice says where search words go; unavailable is said in words", async () => {
    const onGotIt = vi.fn();
    render(
      <GifPicker
        {...BASE}
        status="unavailable"
        results={[]}
        notice={{ text: "Sent to our GIF service", gotIt: "Got it", onGotIt }}
      />,
    );
    expect(screen.getByRole("note")).toHaveTextContent("Sent to our GIF service");
    expect(screen.getByText("GIFs aren't available")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(onGotIt).toHaveBeenCalled();
  });
});
