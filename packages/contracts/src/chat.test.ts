// Unit tests for the stored message document (F03 design.md 5.2): only the allowed blocks and
// marks pass, with the length, size, nesting and link rules.
import { describe, expect, it } from "vitest";
import { MAX_LINK_LENGTH, documentPlainText, messageDocumentSchema } from "./chat.ts";

const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const doc = (...blocks: unknown[]) => ({ v: 1, blocks });
const passes = (value: unknown) => messageDocumentSchema.safeParse(value).success;

function nestedList(depth: number): unknown {
  const inner: unknown[] = [paragraph(text("item"))];
  if (depth > 1) inner.push(nestedList(depth - 1));
  return { type: "bulletList", items: [{ content: inner }] };
}

describe("TC-F03-27 document shape checks", () => {
  it("TC-F03-27 [AC-F03-15] every allowed block and mark passes", () => {
    const all = doc(
      paragraph(
        text("bold", [{ type: "bold" }]),
        text("italic", [{ type: "italic" }]),
        text("underline", [{ type: "underline" }]),
        text("strike", [{ type: "strike" }]),
        text("code", [{ type: "code" }]),
        text("link", [{ type: "link", href: "https://example.com/a" }]),
        { type: "hardBreak" },
        text("plain http", [{ type: "link", href: "http://example.com" }]),
      ),
      { type: "bulletList", items: [{ content: [paragraph(text("a"))] }] },
      { type: "orderedList", items: [{ content: [paragraph(text("b"))] }] },
      { type: "quote", content: [paragraph(text("quoted"))] },
      { type: "codeBlock", language: "typescript", text: "const a = 1;\n\tif (a) {}" },
      nestedList(3),
    );
    expect(passes(all)).toBe(true);
  });

  it.each([
    ["an unknown block (image)", doc({ type: "image", src: "https://example.com/a.png" })],
    ["an unknown block (html)", doc({ type: "html", html: "<b>x</b>" })],
    ["an unknown mark (color)", doc(paragraph(text("x", [{ type: "color", value: "red" }])))],
    ["a javascript: link", doc(paragraph(text("x", [{ type: "link", href: "javascript:alert(1)" }])))],
    ["a data: link", doc(paragraph(text("x", [{ type: "link", href: "data:text/html,<b>x</b>" }])))],
    [
      "a link over 2,000 characters",
      doc(paragraph(text("x", [{ type: "link", href: `https://example.com/${"a".repeat(MAX_LINK_LENGTH)}` }]))),
    ],
    ["lists nested 4 levels", doc(nestedList(4))],
    [
      "a document over 32 KB with little visible text",
      doc(
        ...Array.from({ length: 20 }, () =>
          paragraph(text("x", [{ type: "link", href: `https://example.com/${"a".repeat(1900)}` }])),
        ),
      ),
    ],
    ["version 2", { v: 2, blocks: [paragraph(text("x"))] }],
    ["an extra field on a block", doc({ type: "paragraph", content: [], style: "color:red" })],
    ["no blocks", doc()],
  ])("TC-F03-27 [AC-F03-17] refuses %s", (_name, value) => {
    expect(passes(value)).toBe(false);
  });

  // The line break between two blocks counts as one character, as it does when the text is copied.
  it("TC-F03-27 [AC-F03-03] [AC-F03-16] code counts toward the 4,000 visible characters", () => {
    expect(passes(doc(paragraph(text("a".repeat(2999))), { type: "codeBlock", text: "b".repeat(1000) }))).toBe(true);
    expect(passes(doc(paragraph(text("a".repeat(2999))), { type: "codeBlock", text: "b".repeat(1001) }))).toBe(false);
  });

  it("TC-F03-27 [AC-F03-16] the visible text keeps code exactly", () => {
    const code = "  if (x) {\n\treturn '<b>';\n  }";
    expect(documentPlainText(messageDocumentSchema.parse(doc({ type: "codeBlock", text: code })))).toBe(code);
  });
});
