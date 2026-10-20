// GifImage tests (F03 TC-F03-45): with "reduce motion" the still picture shows first; a GIF can be
// paused and played; it is described in words.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GifImage } from "./GifImage.tsx";

const BASE = {
  url: "https://static.klipy.com/a.gif",
  stillUrl: "https://static.klipy.com/a.jpg",
  description: "GIF: waving cat",
  width: 200,
  height: 150,
  labels: { pause: "Pause GIF", play: "Play GIF", attribution: "Powered by KLIPY" },
};

describe("GifImage", () => {
  it("TC-F03-45 [AC-F03-25] reduce motion starts with the still picture; Play starts the GIF", async () => {
    render(<GifImage {...BASE} reduceMotion />);
    expect(screen.getByRole("img", { name: "GIF: waving cat" })).toHaveAttribute("src", BASE.stillUrl);
    await userEvent.click(screen.getByRole("button", { name: "Play GIF" }));
    expect(screen.getByRole("img", { name: "GIF: waving cat" })).toHaveAttribute("src", BASE.url);
  });

  it("TC-F03-45 [AC-F03-25] a playing GIF can be paused; KLIPY is named", async () => {
    render(<GifImage {...BASE} reduceMotion={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Pause GIF" }));
    expect(screen.getByRole("img", { name: "GIF: waving cat" })).toHaveAttribute("src", BASE.stillUrl);
    expect(screen.getByText("Powered by KLIPY")).toBeInTheDocument();
  });
});
