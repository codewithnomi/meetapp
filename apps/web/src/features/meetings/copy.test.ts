// Copy to the clipboard says whether it worked (AC-F02-01).
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./copy.ts";

afterEach(() => vi.unstubAllGlobals());
const clipboard = (writeText: () => Promise<void>) => vi.stubGlobal("navigator", { clipboard: { writeText } });

describe("copyText", () => {
  it("TC-F02-02 [AC-F02-01] copies the text and says so", async () => {
    const writeText = vi.fn(async () => undefined);
    clipboard(writeText);
    expect(await copyText("hello")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("TC-F02-02 [AC-F02-01] a refused copy answers false instead of throwing", async () => {
    clipboard(async () => Promise.reject(new Error("denied")));
    expect(await copyText("hello")).toBe(false);
  });
});
