// The person's own camera, mirrored and silent (AC-F02-09).
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocalVideo } from "./LocalVideo.tsx";

describe("LocalVideo", () => {
  it("TC-F02-17 [AC-F02-09] plays the stream muted and mirrored, and follows a new stream", () => {
    const a = { id: "a" } as unknown as MediaStream;
    const b = { id: "b" } as unknown as MediaStream;
    const { container, rerender } = render(<LocalVideo stream={a} />);
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(video).toHaveClass("-scale-x-100");
    expect(video.srcObject).toBe(a);
    rerender(<LocalVideo stream={b} />);
    expect(video.srcObject).toBe(b);
  });
});
