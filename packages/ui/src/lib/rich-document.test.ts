// The message box's content turned into the stored document (F03 TC-F03-31, 28, 05 app parts).
import { describe, expect, it } from "vitest";
import type { RichDocument } from "../molecules/MessageBody/index.ts";
import { emojiOnly, toRichDocument, visibleText } from "./rich-document.ts";

// Test nodes are loose on purpose (some are not valid TipTap nodes), so they are typed as `never`.
const text = (value: string, marks?: object[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) }) as never;

describe("TC-F03-31 the message box keeps only allowed formatting", () => {
  it("TC-F03-28 [AC-F03-15] every allowed block and mark is kept", () => {
    const doc = toRichDocument({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            text("b", [{ type: "bold" }]),
            text("l", [{ type: "link", attrs: { href: "https://example.com" } }]),
          ],
        },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("one")] }] }],
        },
        { type: "blockquote", content: [{ type: "paragraph", content: [text("q")] }] },
        { type: "codeBlock", attrs: { language: "typescript" }, content: [text("const a = 1;\n\tb()")] },
      ],
    });
    expect(doc).toEqual({
      v: 1,
      blocks: [
        {
          type: "paragraph",
          content: [text("b", [{ type: "bold" }]), text("l", [{ type: "link", href: "https://example.com" }])],
        },
        { type: "bulletList", items: [{ content: [{ type: "paragraph", content: [text("one")] }] }] },
        { type: "quote", content: [{ type: "paragraph", content: [text("q")] }] },
        { type: "codeBlock", language: "typescript", text: "const a = 1;\n\tb()" },
      ],
    });
  });

  it("TC-F03-31 [AC-F03-17] pasted extras become plain text; bad links and marks are dropped", () => {
    const doc = toRichDocument({
      type: "doc",
      content: [
        { type: "heading", content: [text("Big title")] },
        {
          type: "paragraph",
          content: [
            text("x", [
              { type: "link", attrs: { href: "javascript:alert(1)" } },
              { type: "textStyle", attrs: { color: "red" } },
            ]),
            { type: "image", attrs: { src: "https://e/x.png" } },
          ],
        },
      ],
    });
    expect(doc.blocks).toEqual([
      { type: "paragraph", content: [text("Big title")] },
      { type: "paragraph", content: [text("x")] },
    ]);
  });

  it("TC-F03-05 [AC-F03-03] the visible text counts like the server: blocks joined by line breaks", () => {
    const doc = toRichDocument({
      type: "doc",
      content: [
        { type: "paragraph", content: [text("ab")] },
        { type: "codeBlock", content: [text("cd")] },
      ],
    });
    expect(visibleText(doc)).toBe("ab\ncd");
  });
});

describe("TC-F03-21 a sent message back in the box for editing", () => {
  it("TC-F03-21 [AC-F03-10] the document goes into the editor and comes back unchanged", async () => {
    const { toEditorDocument } = await import("./rich-document.ts");
    const document = {
      v: 1 as const,
      blocks: [
        {
          type: "paragraph" as const,
          content: [{ type: "text" as const, text: "b", marks: [{ type: "bold" as const }] }],
        },
        {
          type: "orderedList" as const,
          items: [{ content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: "one" }] }] }],
        },
        { type: "codeBlock" as const, text: "x = 1" },
      ],
    };
    expect(toRichDocument(toEditorDocument(document))).toEqual(document);
  });
});

const plain = (text: string, marks?: { type: "bold" }[]): RichDocument => ({
  v: 1,
  blocks: [{ type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] }],
});

describe("emojiOnly", () => {
  it("TC-F03-95 [AC-F03-47] 1 to 3 emoji alone show larger; with text, more than 3, or formatted they don't", () => {
    for (const text of ["👍", "🎉🎉🎉", "👍🏽 ❤️", "👨‍👩‍👧"]) expect(emojiOnly(plain(text))).toBe(true);
    for (const text of ["👍 ok", "🎉🎉🎉🎉", "hi", "1"]) expect(emojiOnly(plain(text))).toBe(false);
    expect(emojiOnly(plain("👍", [{ type: "bold" }]))).toBe(false);
  });
});
