// A video tile attaches the track to its element and lets go on the way out (AC-F02-19).
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrackVideo } from "./TrackVideo.tsx";

const track = () => ({ attach: vi.fn(), detach: vi.fn() });
type Track = Parameters<typeof TrackVideo>[0]["track"];

describe("TrackVideo", () => {
  it("TC-F02-30 [AC-F02-19] attaches the track to a muted video and detaches on unmount", () => {
    const t = track();
    const { container, unmount } = render(<TrackVideo track={t as unknown as Track} />);
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(video).not.toHaveClass("-scale-x-100");
    expect(t.attach).toHaveBeenCalledWith(video);
    unmount();
    expect(t.detach).toHaveBeenCalledWith(video);
  });

  it("TC-F02-30 [AC-F02-19] your own camera is mirrored; a new track replaces the old", () => {
    const a = track();
    const b = track();
    const { container, rerender } = render(<TrackVideo track={a as unknown as Track} mirrored />);
    expect(container.querySelector("video")).toHaveClass("-scale-x-100");
    rerender(<TrackVideo track={b as unknown as Track} mirrored />);
    expect(a.detach).toHaveBeenCalled();
    expect(b.attach).toHaveBeenCalled();
  });
});
