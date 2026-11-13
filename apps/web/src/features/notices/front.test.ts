// Whether the window is in front (F04 design 3.4; TC-F04-53, 62): the desktop app's word wins over the
// browser's own signals, which say "visible" for a hidden window during a call.
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  delete (window as { meetapp?: unknown }).meetapp;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("window in front", () => {
  it("TC-F04-62 [AC-F04-34] follows the desktop app once it has said, else the browser", async () => {
    let tell: (action: unknown) => void = () => undefined;
    (window as { meetapp?: unknown }).meetapp = {
      callWindows: {
        onAction: (listener: (action: unknown) => void) => {
          tell = listener;
          return () => undefined;
        },
      },
    };
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const { windowInFront } = await import("./front.ts");
    expect(windowInFront()).toBe(true);
    tell({ name: "windowFront", on: false });
    expect(windowInFront()).toBe(false);
    // Anything else on the line changes nothing.
    tell({ name: "windowFront", on: "yes" });
    tell({ name: "noticeChosen", cardId: "x", choice: "open" });
    expect(windowInFront()).toBe(false);
    tell({ name: "windowFront", on: true });
    expect(windowInFront()).toBe(true);
  });

  it("TC-F04-53 [AC-F04-31] in a browser, the page's own signals", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    const { windowInFront } = await import("./front.ts");
    expect(windowInFront()).toBe(false);
  });
});
