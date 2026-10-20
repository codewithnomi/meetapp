// Gallery tests (AC-F02-20, AC-F02-44): the given tiles in a list, columns that follow the count, page
// arrows that work from the keyboard and are off at the ends, and the speaker layout.
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Gallery, type GalleryTile } from "./Gallery.tsx";

const tiles = (count: number): GalleryTile[] =>
  Array.from({ length: count }, (_, i) => ({ id: `p${String(i)}`, tile: <span>{`Person ${String(i)}`}</span> }));

describe("Gallery", () => {
  it("TC-F02-86 [AC-F02-20] shows every given tile, in columns that follow the count", () => {
    const { rerender } = render(<Gallery label="Participants' video" layout="gallery" tiles={tiles(16)} />);
    const list = within(screen.getByRole("region", { name: "Participants' video" })).getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(16);
    expect(list).toHaveClass("grid-cols-4");
    rerender(<Gallery label="Participants' video" layout="gallery" tiles={tiles(3)} />);
    expect(screen.getByRole("list")).toHaveClass("grid-cols-2");
  });

  it("TC-F02-86 [AC-F02-44] page arrows work with the keyboard and are off at the ends", async () => {
    const onNext = vi.fn();
    render(
      <Gallery
        label="Participants' video, page 1 of 2"
        layout="gallery"
        tiles={tiles(16)}
        pages={{
          text: "Page 1 of 2 · 23 people",
          label: "Gallery pages",
          previousLabel: "Previous page",
          nextLabel: "Next page",
          onNext,
        }}
      />,
    );
    const pages = screen.getByRole("navigation", { name: "Gallery pages" });
    expect(within(pages).getByRole("button", { name: "Previous page" })).toBeDisabled();
    within(pages).getByRole("button", { name: "Next page" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(pages).toHaveTextContent("Page 1 of 2 · 23 people");
  });

  it("TC-F02-86 [AC-F02-20] speaker view: one large tile, four in the strip and the rest counted", () => {
    render(<Gallery label="Speaker view" layout="speaker" tiles={tiles(8)} moreText="+ 3 more" />);
    expect(screen.getByText("Person 0")).toBeInTheDocument();
    const strip = screen.getByRole("list");
    expect(
      within(strip)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Person 1", "Person 2", "Person 3", "Person 4", "+ 3 more"]);
    expect(screen.queryByText("Person 5")).not.toBeInTheDocument();
  });
});
