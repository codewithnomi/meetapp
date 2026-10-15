// VideoTile tests (AC-F02-21, 23, 24): the speaker is marked by a ring and a word, the tile's spoken
// name sums up its states, the video shows only with the camera on, and names stay text (AC-F02-51).
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VideoTile } from "./VideoTile.tsx";

/** Stands in for the live video element the page supplies. */
const VIDEO = <div data-testid="live" />;

describe("VideoTile", () => {
  it("TC-F02-86 [AC-F02-21] a speaker gets the ring and the word, and screen readers hear it", () => {
    const { container } = render(<VideoTile name="Bilal Ahmed" video={VIDEO} speakingText="Speaking" />);
    expect(screen.getByRole("figure", { name: "Bilal Ahmed, Speaking" })).toBeInTheDocument();
    expect(container.querySelector("[data-speaking-ring]")).toHaveClass("ring-speaking");
    expect(screen.getByText("Speaking")).toBeInTheDocument();
  });

  it("TC-F02-86 [AC-F02-23] the spoken name lists role, hand, mute and a weak connection", () => {
    render(
      <VideoTile
        name="Sara Malik"
        roleLabel="Presenter"
        handText="Hand raised"
        mutedLabel="Muted"
        weakText="Weak connection"
      />,
    );
    expect(screen.getByRole("figure")).toHaveAccessibleName(
      "Sara Malik, Presenter, Hand raised, Muted, Weak connection",
    );
  });

  it("TC-F02-86 [AC-F02-22] the video shows with the camera on; with it off, the initials", () => {
    const { rerender } = render(<VideoTile name="Aisha Khan" video={VIDEO} />);
    expect(screen.getByTestId("live")).toBeInTheDocument();
    rerender(<VideoTile name="Aisha Khan" video={VIDEO} cameraOff />);
    expect(screen.queryByTestId("live")).not.toBeInTheDocument();
    expect(screen.getByText("AK")).toBeInTheDocument();
  });

  it("TC-F02-86 [AC-F02-24] [AC-F02-44] a reaction shows; Unpin works from the keyboard", async () => {
    const onUnpin = vi.fn();
    render(
      <VideoTile
        name="Omar Farooq"
        reaction={{ emoji: "👏", text: "Omar Farooq" }}
        pinned={{ text: "Pinned for you", unpinLabel: "Unpin", onUnpin }}
      />,
    );
    expect(screen.getByText("👏")).toBeInTheDocument();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Unpin" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onUnpin).toHaveBeenCalledTimes(1);
  });

  it("TC-F02-107 [AC-F02-51] a name that looks like HTML is text", () => {
    render(<VideoTile name="<img src=x onerror=alert(1)>" />);
    expect(screen.getByRole("figure")).toHaveAccessibleName("<img src=x onerror=alert(1)>");
    expect(document.querySelector("img[src='x']")).toBeNull();
  });
});
