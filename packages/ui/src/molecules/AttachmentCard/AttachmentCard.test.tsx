// AttachmentCard tests (F03 TC-F03-53): files show name, kind and size with Download; pictures show a
// preview, and a preview that fails falls back to name and Download (AC-F03-28).
import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AttachmentCard } from "./AttachmentCard.tsx";

const BASE = { fileName: "plan.pdf", details: "PDF · 1.4 MB", downloadLabel: "Download" };

describe("AttachmentCard", () => {
  it("TC-F03-53 [AC-F03-28] a file shows its name and size and downloads", async () => {
    const onDownload = vi.fn();
    render(<AttachmentCard {...BASE} onDownload={onDownload} />);
    expect(screen.getByText("plan.pdf")).toBeInTheDocument();
    expect(screen.getByText("PDF · 1.4 MB")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(onDownload).toHaveBeenCalled();
  });

  it("TC-F03-53 [AC-F03-28] a picture shows its preview; a broken preview falls back to Download", () => {
    const { container } = render(
      <AttachmentCard
        {...BASE}
        fileName="a.png"
        previewUrl="https://x/p.webp"
        previewLabel="Picture: a.png, open larger"
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Picture: a.png, open larger" })).toBeInTheDocument();
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });
});
