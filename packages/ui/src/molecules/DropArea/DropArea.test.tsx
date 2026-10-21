// DropArea tests (F03 TC-F03-54): the area is announced, and the drag counting doesn't flicker.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DropArea, trackDrag } from "./DropArea.tsx";

describe("TC-F03-54 drop area counting", () => {
  it("TC-F03-54 [AC-F03-29] shows while files are over the window, through child elements, until dropped or left", () => {
    const drag = trackDrag();
    expect(drag.enter(true)).toBe(true);
    expect(drag.enter(true)).toBe(true); // over a child element
    expect(drag.leave()).toBe(true); // left the child, still over the window
    expect(drag.leave()).toBe(false); // left the window
    expect(drag.enter(false)).toBe(false); // dragging text, not files
    expect(drag.enter(true)).toBe(true);
    expect(drag.drop()).toBe(false);
  });

  it("TC-F03-54 [AC-F03-29] [AC-F03-45] the area is announced in words", () => {
    render(<DropArea title="Drop files to share in chat" hint="up to 25 MB each" />);
    expect(screen.getByRole("status")).toHaveTextContent("Drop files to share in chat");
  });
});
