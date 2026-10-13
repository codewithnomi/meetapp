// AvatarUpload tests (TC-F01-68, AC-F01-25, 28): the button opens the file picker and the chosen file is
// reported; Remove shows only with a photo; an error replaces the rule and is announced.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AvatarUpload, type AvatarUploadProps } from "./AvatarUpload.tsx";

const LABELS = { upload: "Upload a photo", remove: "Remove", hint: "JPEG, PNG or WebP.", uploading: "Uploading" };

function setUp(overrides: Partial<AvatarUploadProps> = {}) {
  const handlers = { onFile: vi.fn(), onRemove: vi.fn() };
  const view = render(<AvatarUpload name="Aisha Khan" labels={LABELS} {...handlers} {...overrides} />);
  return { ...handlers, view };
}
const picker = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]');

describe("AvatarUpload", () => {
  it("TC-F01-68 [AC-F01-25] without a photo: initials, the rule, no Remove; a chosen file is reported", async () => {
    const { onFile, view } = setUp();
    expect(screen.getByRole("img", { name: "Aisha Khan" })).toHaveTextContent("AK");
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload a photo" })).toHaveAccessibleDescription("JPEG, PNG or WebP.");
    const input = picker(view.container);
    if (!input) throw new Error("no file picker");
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    const file = new File(["x"], "me.png", { type: "image/png" });
    await userEvent.upload(input, file);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("TC-F01-68 [AC-F01-25] the button opens the picker", async () => {
    const { view } = setUp();
    const input = picker(view.container);
    if (!input) throw new Error("no file picker");
    const click = vi.spyOn(input, "click");
    await userEvent.click(screen.getByRole("button", { name: "Upload a photo" }));
    expect(click).toHaveBeenCalled();
  });

  it("TC-F01-68 [AC-F01-25] with a photo, Remove reports; an error is announced; busy blocks both", async () => {
    const { onRemove, view } = setUp({
      photoUrl: "http://x/p.webp",
      error: "Use a JPEG, PNG or WebP image up to 5 MB.",
    });
    expect(view.container.querySelector("img")).toHaveAttribute("src", "http://x/p.webp");
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Use a JPEG, PNG or WebP image up to 5 MB.");
    view.rerender(
      <AvatarUpload
        name="Aisha Khan"
        photoUrl="http://x/p.webp"
        busy
        labels={LABELS}
        onFile={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Upload a photo/ })).toBeDisabled();
  });
});
