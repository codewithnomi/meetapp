// FileChip tests (F03 TC-F03-12, 55): uploading is spoken, a failed upload offers Retry, and a file can
// be removed before sending.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileChip } from "./FileChip.tsx";

describe("FileChip", () => {
  it("TC-F03-12 [AC-F03-05] a failed upload offers Retry; the file can be removed", async () => {
    const onRetry = vi.fn();
    const onRemove = vi.fn();
    render(
      <FileChip
        text="roadmap.xlsx"
        state="failed"
        failed={{ label: "Upload failed", retryLabel: "Retry", onRetry }}
        removeLabel="Remove roadmap.xlsx"
        onRemove={onRemove}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove roadmap.xlsx" }));
    expect(onRetry).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalled();
  });

  it("TC-F03-55 [AC-F03-29] an upload in progress is spoken", () => {
    render(
      <FileChip
        text="screen.png · 62%"
        state="uploading"
        uploadingLabel="Uploading screen.png"
        removeLabel="Cancel"
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Uploading screen.png");
  });
});
