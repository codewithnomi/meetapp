// What the message box (TipTap) holds, turned into the stored message document (F03 design.md 5.2).
// Only the allowed blocks and marks survive: anything else typed or pasted becomes plain text, and links
// keep only http and https addresses (AC-F03-04, 15, 17). Also counts the visible characters (AC-F03-03).
import type { RichDocument } from "../molecules/MessageBody/index.ts";

/** TipTap's JSON (the parts read here). */
export interface EditorNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: EditorNode[];
}

type Block = RichDocument["blocks"][number];
type Paragraph = Extract<Block, { type: "paragraph" }>;
type Inline = NonNullable<Paragraph["content"]>[number];
type Mark = NonNullable<Extract<Inline, { type: "text" }>["marks"]>[number];

const SIMPLE_MARKS = new Set(["bold", "italic", "underline", "strike", "code"]);
const MAX_LIST_DEPTH = 3;

function webLink(href: unknown): string | undefined {
  if (typeof href !== "string") return undefined;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? href : undefined;
  } catch {
    return undefined;
  }
}

function marksOf(node: EditorNode): Mark[] {
  const marks: Mark[] = [];
  for (const mark of node.marks ?? []) {
    if (SIMPLE_MARKS.has(mark.type)) marks.push({ type: mark.type as "bold" });
    const href = mark.type === "link" ? webLink(mark.attrs?.["href"]) : undefined;
    if (href) marks.push({ type: "link", href });
  }
  return marks;
}

/** Text of any node, for parts that can't keep their shape. */
function textOf(node: EditorNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(textOf).join("");
}

function inlines(node: EditorNode): Inline[] {
  const parts: Inline[] = [];
  for (const child of node.content ?? []) {
    if (child.type === "hardBreak") parts.push({ type: "hardBreak" });
    else if (child.type === "text" && child.text) {
      const marks = marksOf(child);
      parts.push({ type: "text", text: child.text, ...(marks.length > 0 ? { marks } : {}) });
    } else {
      const text = textOf(child);
      if (text) parts.push({ type: "text", text });
    }
  }
  return parts;
}

function paragraph(node: EditorNode): Paragraph {
  const content = inlines(node);
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

function list(node: EditorNode, depth: number): Block {
  const items = (node.content ?? []).map((item) => ({
    content: (item.content ?? []).map((part) =>
      (part.type === "bulletList" || part.type === "orderedList") && depth < MAX_LIST_DEPTH
        ? (list(part, depth + 1) as Exclude<Block, Paragraph>)
        : paragraph(part),
    ),
  }));
  return { type: node.type === "orderedList" ? "orderedList" : "bulletList", items } as Block;
}

function block(node: EditorNode): Block {
  switch (node.type) {
    case "bulletList":
    case "orderedList":
      return list(node, 1);
    case "blockquote":
      return { type: "quote", content: (node.content ?? []).map(paragraph) };
    case "codeBlock": {
      const language = node.attrs?.["language"];
      const valid = typeof language === "string" && /^[a-z0-9+#-]{1,30}$/.test(language);
      return { type: "codeBlock", text: textOf(node), ...(valid ? { language } : {}) };
    }
    default:
      return paragraph(node);
  }
}

/** The stored document for what is in the box. */
export function toRichDocument(doc: EditorNode): RichDocument {
  return { v: 1, blocks: (doc.content ?? []).map(block) };
}

function paragraphText(part: Paragraph): string {
  return (part.content ?? []).map((inline) => (inline.type === "text" ? inline.text : "\n")).join("");
}

function blockLines(part: Block): string[] {
  if (part.type === "paragraph") return [paragraphText(part)];
  if (part.type === "codeBlock") return [part.text];
  if (part.type === "quote") return part.content.map(paragraphText);
  return part.items.flatMap((item) => item.content.flatMap(blockLines));
}

/** The visible text, as the server counts it: blocks joined by line breaks (AC-F03-03). */
export function visibleText(document: RichDocument): string {
  return document.blocks.flatMap(blockLines).join("\n");
}

function editorInlines(content: Paragraph["content"]): EditorNode[] {
  return (content ?? []).map((part) =>
    part.type === "hardBreak"
      ? { type: "hardBreak" }
      : {
          type: "text",
          text: part.text,
          ...(part.marks
            ? {
                marks: part.marks.map((mark) =>
                  mark.type === "link" ? { type: "link", attrs: { href: mark.href } } : { type: mark.type },
                ),
              }
            : {}),
        },
  );
}

function editorBlock(part: Block): EditorNode {
  switch (part.type) {
    case "paragraph":
      return { type: "paragraph", content: editorInlines(part.content) };
    case "quote":
      return { type: "blockquote", content: part.content.map(editorBlock) };
    case "codeBlock":
      return {
        type: "codeBlock",
        attrs: { language: part.language ?? null },
        content: part.text ? [{ type: "text", text: part.text }] : [],
      };
    default:
      return {
        type: part.type,
        content: part.items.map((item) => ({ type: "listItem", content: item.content.map(editorBlock) })),
      };
  }
}

/** A stored document back in the editor, for editing a sent message (AC-F03-10). */
export function toEditorDocument(document: RichDocument): EditorNode {
  return { type: "doc", content: document.blocks.map(editorBlock) };
}

const MAX_BIG_EMOJI = 3;
// Shown as a picture by default, or marked so (FE0F); ©, ® and ™ alone are text, not emoji.
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|\p{Regional_Indicator}/u;

/** 1–3 emoji and nothing else (spaces aside), so the message shows them larger (AC-F03-47). */
export function emojiOnly(document: RichDocument): boolean {
  const [only, ...rest] = document.blocks;
  if (!only || rest.length > 0 || only.type !== "paragraph") return false;
  const parts = only.content ?? [];
  if (parts.some((part) => part.type !== "text" || (part.marks?.length ?? 0) > 0)) return false;
  const text = parts.map((part) => (part.type === "text" ? part.text : "")).join("");
  const symbols = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)]
    .map((piece) => piece.segment)
    .filter((piece) => piece.trim() !== "");
  return symbols.length > 0 && symbols.length <= MAX_BIG_EMOJI && symbols.every((piece) => EMOJI.test(piece));
}
