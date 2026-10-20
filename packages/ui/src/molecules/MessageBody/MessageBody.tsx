// MessageBody (molecule): draws a chat message from its stored document (F03 design.md 5.2): paragraphs,
// lists, quotes, code blocks, and the marks bold, italic, underline, strike, code and link. It never
// uses HTML: React writes every piece of text as text, so a message can't carry page code (S11,
// AC-F03-04, 16, 17). Web addresses in plain text become links; links open outside the app through
// `onOpenLink`. Code blocks keep their text exactly and have a Copy button (labels arrive as props).
import type { ReactNode } from "react";
import { Button } from "../../atoms/Button/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

type RichMark = { type: "bold" | "italic" | "underline" | "strike" | "code" } | { type: "link"; href: string };
type RichInline = { type: "text"; text: string; marks?: RichMark[] | undefined } | { type: "hardBreak" };
interface RichParagraph {
  type: "paragraph";
  content?: RichInline[] | undefined;
}
interface RichList {
  type: "bulletList" | "orderedList";
  items: { content: (RichParagraph | RichList)[] }[];
}
type RichBlock =
  | RichParagraph
  | RichList
  | { type: "quote"; content: RichParagraph[] }
  | { type: "codeBlock"; language?: string | undefined; text: string };
export interface RichDocument {
  v: 1;
  blocks: RichBlock[];
}

export interface MessageBodyProps {
  document: RichDocument;
  /** Opens a link in the person's browser (the desktop app sends it outside, D040). */
  onOpenLink: (href: string) => void;
  /** Copies a code block's text exactly. */
  onCopyCode: (text: string) => void;
  /** "Copy" (translated). */
  copyLabel: string;
  /** Only emoji: shown larger (AC-F03-47). */
  big?: boolean | undefined;
}

/** Only web links are ever links (AC-F03-04). */
export function isWebLink(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

function Link({ href, children, onOpen }: { href: string; children: ReactNode; onOpen: (href: string) => void }) {
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onOpen(href);
      }}
      className={cx("break-all text-accent-text underline", FOCUS_RING)}
      rel="noreferrer noopener"
    >
      {children}
    </a>
  );
}

/** Plain text with its web addresses turned into links. */
function linkify(text: string, onOpen: (href: string) => void): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_IN_TEXT)) {
    const start = match.index;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <Link key={start} href={match[0]} onOpen={onOpen}>
        {match[0]}
      </Link>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function withMark(node: ReactNode, mark: RichMark, onOpen: (href: string) => void): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong>{node}</strong>;
    case "italic":
      return <em>{node}</em>;
    case "underline":
      return <u>{node}</u>;
    case "strike":
      return <s>{node}</s>;
    case "code":
      return <code className="rounded-sm bg-surface px-1 font-mono text-[13px]">{node}</code>;
    case "link":
      return isWebLink(mark.href) ? (
        <Link href={mark.href} onOpen={onOpen}>
          {node}
        </Link>
      ) : (
        node
      );
  }
}

function Inline({ part, onOpen }: { part: RichInline; onOpen: (href: string) => void }) {
  if (part.type === "hardBreak") return <br />;
  const marks = part.marks ?? [];
  const isLinkOrCode = marks.some((mark) => mark.type === "link" || mark.type === "code");
  let node: ReactNode = isLinkOrCode ? part.text : linkify(part.text, onOpen);
  for (const mark of marks) node = withMark(node, mark, onOpen);
  return <>{node}</>;
}

function Paragraph({ block, onOpen }: { block: RichParagraph; onOpen: (href: string) => void }) {
  return (
    <p className="m-0 whitespace-pre-wrap">
      {(block.content ?? []).map((part, index) => (
        <Inline key={index} part={part} onOpen={onOpen} />
      ))}
    </p>
  );
}

function List({ block, onOpen }: { block: RichList; onOpen: (href: string) => void }) {
  const Tag = block.type === "orderedList" ? "ol" : "ul";
  return (
    <Tag className={cx("m-0 pl-5", Tag === "ol" ? "list-decimal" : "list-disc")}>
      {block.items.map((item, index) => (
        <li key={index}>
          {item.content.map((part, inner) =>
            part.type === "paragraph" ? (
              <Paragraph key={inner} block={part} onOpen={onOpen} />
            ) : (
              <List key={inner} block={part} onOpen={onOpen} />
            ),
          )}
        </li>
      ))}
    </Tag>
  );
}

function CodeBlock({ text, onCopy, copyLabel }: { text: string; onCopy: (text: string) => void; copyLabel: string }) {
  return (
    <div className="relative">
      <pre className="m-0 overflow-x-auto rounded-sm bg-stage px-3 py-2.5 pr-20 font-mono text-[12px] leading-4.5 text-stage-ink">
        <code>{text}</code>
      </pre>
      <Button variant="secondary" size="sm" className="absolute top-1.5 right-1.5" onClick={() => onCopy(text)}>
        {copyLabel}
      </Button>
    </div>
  );
}

export function MessageBody({ document, onOpenLink, onCopyCode, copyLabel, big = false }: MessageBodyProps) {
  return (
    <div
      className={cx(
        "flex min-w-0 flex-col gap-1.5 [overflow-wrap:anywhere]",
        big ? "text-[32px] leading-10" : "text-[14px] leading-5.5",
      )}
    >
      {document.blocks.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return <Paragraph key={index} block={block} onOpen={onOpenLink} />;
          case "bulletList":
          case "orderedList":
            return <List key={index} block={block} onOpen={onOpenLink} />;
          case "quote":
            return (
              <blockquote key={index} className="m-0 border-l-3 border-line-strong pl-2.5 text-ink-muted">
                {block.content.map((part, inner) => (
                  <Paragraph key={inner} block={part} onOpen={onOpenLink} />
                ))}
              </blockquote>
            );
          case "codeBlock":
            return <CodeBlock key={index} text={block.text} onCopy={onCopyCode} copyLabel={copyLabel} />;
        }
      })}
    </div>
  );
}
