// MessageBody tests (F03 TC-F03-08, 29): text is shown as written, never as page code; only web links
// are links, and they open outside; code blocks keep their text exactly and copy it.
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MessageBody, type RichDocument } from "./MessageBody.tsx";

const show = (document: RichDocument) => {
  const onOpenLink = vi.fn();
  const onCopyCode = vi.fn();
  const view = render(
    <MessageBody document={document} onOpenLink={onOpenLink} onCopyCode={onCopyCode} copyLabel="Copy" />,
  );
  return { ...view, onOpenLink, onCopyCode };
};
const text = (value: string, marks?: unknown[]) =>
  ({ type: "text", text: value, ...(marks ? { marks } : {}) }) as never;

describe("TC-F03-08 the renderer shows text safely", () => {
  it("TC-F03-08 [AC-F03-04] [AC-F03-17] HTML and scripts are shown as typed, nothing runs", () => {
    const evil = '<img src=x onerror="window.hacked=1"><script>window.hacked=1</script>';
    const { container } = show({ v: 1, blocks: [{ type: "paragraph", content: [text(evil)] }] });
    expect(screen.getByText(evil)).toBeInTheDocument();
    expect(container.querySelector("img, script")).toBeNull();
    expect((window as unknown as { hacked?: number }).hacked).toBeUndefined();
  });

  it("TC-F03-08 [AC-F03-04] web addresses become links that open outside; other kinds stay text", async () => {
    const { onOpenLink } = show({
      v: 1,
      blocks: [
        {
          type: "paragraph",
          content: [text("notes at https://example.com/notes, and javascript:alert(1) file:///etc")],
        },
        {
          type: "paragraph",
          content: [
            text("named", [{ type: "link", href: "https://example.com/a" }]),
            text(" bad", [{ type: "link", href: "javascript:alert(1)" }]),
          ],
        },
      ],
    });
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://example.com/notes",
      "https://example.com/a",
    ]);
    await userEvent.click(links[0] as HTMLElement);
    expect(onOpenLink).toHaveBeenCalledWith("https://example.com/notes");
    expect(screen.getByText(/javascript:alert\(1\) file:\/\/\/etc/)).toBeInTheDocument();
  });

  it("TC-F03-08 [AC-F03-15] formatting is drawn with the right elements", () => {
    const { container } = show({
      v: 1,
      blocks: [
        {
          type: "paragraph",
          content: [text("b", [{ type: "bold" }]), text("i", [{ type: "italic" }]), text("c", [{ type: "code" }])],
        },
        { type: "orderedList", items: [{ content: [{ type: "paragraph", content: [text("one")] }] }] },
        { type: "quote", content: [{ type: "paragraph", content: [text("quoted")] }] },
      ],
    });
    expect(container.querySelector("strong")?.textContent).toBe("b");
    expect(container.querySelector("em")?.textContent).toBe("i");
    expect(container.querySelector("code")?.textContent).toBe("c");
    expect(container.querySelector("ol li")?.textContent).toBe("one");
    expect(container.querySelector("blockquote")?.textContent).toBe("quoted");
  });
});

describe("TC-F03-29 code blocks are exact", () => {
  it("TC-F03-29 [AC-F03-16] spaces, tabs and line breaks are kept, nothing becomes a link, Copy copies exactly", async () => {
    const code = "  if (url === \"https://example.com\") {\n\treturn '<b>';\n  }";
    const { container, onCopyCode } = show({ v: 1, blocks: [{ type: "codeBlock", text: code }] });
    expect(container.querySelector("pre code")?.textContent).toBe(code);
    expect(screen.queryByRole("link")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(onCopyCode).toHaveBeenCalledWith(code);
  });
});
