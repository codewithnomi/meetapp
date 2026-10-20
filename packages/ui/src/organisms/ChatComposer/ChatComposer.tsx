// ChatComposer (organism): the message box of the approved "Chat" screen (F03 design.md 5.1): rich text
// with the Format toolbar (bold, italic, underline, strike, lists, quote, link, code, code block) and
// keyboard shortcuts, typing ``` for a code block, an emoji picker, room for more tools (files, GIFs,
// stickers, polls), and a counter near the 4,000-character limit. Enter sends; Shift+Enter starts a
// new line; in lists and code blocks Enter keeps its usual meaning and Ctrl/Cmd+Enter sends. What is
// sent is the stored message document (lib/rich-document.ts), so pasted extras never get through.

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, Extension, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton } from "../../atoms/IconButton/index.ts";
import type { IconName } from "../../atoms/Icon/index.ts";
import { Input } from "../../atoms/Input/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import { toRichDocument, visibleText, type EditorNode } from "../../lib/rich-document.ts";
import { EmojiPicker, type EmojiPickerProps } from "../../molecules/EmojiPicker/index.ts";
import type { RichDocument } from "../../molecules/MessageBody/index.ts";

export const MAX_MESSAGE_CHARS = 4000;

export interface ChatComposerLabels {
  placeholder: string;
  send: string;
  format: string;
  emoji: string;
  formatting: string;
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  bulletList: string;
  orderedList: string;
  quote: string;
  link: string;
  linkAddress: string;
  applyLink: string;
  code: string;
  codeBlock: string;
}

export interface ChatComposerProps {
  labels: ChatComposerLabels;
  /** "212 characters too many" (translated by the page). */
  tooManyLabel: (over: number) => string;
  onSend: (document: RichDocument) => void;
  /** True when something else (files) may be sent without text. */
  allowEmpty?: boolean;
  emoji: Omit<EmojiPickerProps, "onPick">;
  onEmojiUsed?: ((emoji: string) => void) | undefined;
  /** A reply quote or files waiting to be sent, above the text. */
  above?: ReactNode;
  /** More tools after the emoji button: attach, GIF, sticker, poll. */
  tools?: ReactNode;
  onEscape?: (() => void) | undefined;
}

const TOOLS: { mark: string; icon: IconName; label: keyof ChatComposerLabels; run: (editor: Editor) => void }[] = [
  { mark: "bold", icon: "bold", label: "bold", run: (e) => e.chain().focus().toggleBold().run() },
  { mark: "italic", icon: "italic", label: "italic", run: (e) => e.chain().focus().toggleItalic().run() },
  { mark: "underline", icon: "underline", label: "underline", run: (e) => e.chain().focus().toggleUnderline().run() },
  { mark: "strike", icon: "strike", label: "strike", run: (e) => e.chain().focus().toggleStrike().run() },
  { mark: "bulletList", icon: "list", label: "bulletList", run: (e) => e.chain().focus().toggleBulletList().run() },
  {
    mark: "orderedList",
    icon: "list-ordered",
    label: "orderedList",
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  { mark: "blockquote", icon: "quote", label: "quote", run: (e) => e.chain().focus().toggleBlockquote().run() },
  { mark: "code", icon: "code", label: "code", run: (e) => e.chain().focus().toggleCode().run() },
  { mark: "codeBlock", icon: "code-block", label: "codeBlock", run: (e) => e.chain().focus().toggleCodeBlock().run() },
];

/** Enter sends, except inside lists and code blocks; Ctrl/Cmd+Enter always sends; Escape cancels. */
function sendKeys(send: { current: () => void }, escape: { current: (() => void) | undefined }) {
  return Extension.create({
    name: "meetappSendKeys",
    addKeyboardShortcuts() {
      return {
        Enter: () => {
          if (this.editor.isActive("codeBlock") || this.editor.isActive("listItem")) return false;
          send.current();
          return true;
        },
        "Mod-Enter": () => (send.current(), true),
        Escape: () => (escape.current ? (escape.current(), true) : false),
      };
    },
  });
}

function useComposerEditor(
  labels: ChatComposerLabels,
  send: { current: () => void },
  escape: { current: (() => void) | undefined },
) {
  const [, redraw] = useState(0);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ["http", "https"],
          isAllowedUri: (url) => /^https?:\/\//i.test(url),
        },
      }),
      Placeholder.configure({ placeholder: labels.placeholder }),
      sendKeys(send, escape),
    ],
    editorProps: {
      attributes: { "aria-label": labels.placeholder, role: "textbox", "aria-multiline": "true", spellcheck: "true" },
    },
    onUpdate: () => redraw((n) => n + 1),
    onSelectionUpdate: () => redraw((n) => n + 1),
  });
  return editor;
}

function LinkForm({ editor, labels, onDone }: { editor: Editor; labels: ChatComposerLabels; onDone: () => void }) {
  const [href, setHref] = useState("https://");
  const valid = /^https?:\/\/\S+$/i.test(href);
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
        onDone();
      }}
    >
      <div className="min-w-0 flex-1">
        <Input
          id="chat-link-address"
          label={labels.linkAddress}
          value={href}
          onChange={(event) => setHref(event.target.value)}
        />
      </div>
      <IconButton icon="check" label={labels.applyLink} variant="ghost" size="sm" type="submit" disabled={!valid} />
    </form>
  );
}

function FormatBar({ editor, labels }: { editor: Editor; labels: ChatComposerLabels }) {
  const [linking, setLinking] = useState(false);
  return (
    <div className="flex flex-col gap-2 border-b border-line pb-1.5">
      <div role="toolbar" aria-label={labels.formatting} className="flex flex-wrap gap-0.5">
        {TOOLS.map((tool) => (
          <IconButton
            key={tool.mark}
            icon={tool.icon}
            label={labels[tool.label]}
            variant="ghost"
            size="sm"
            active={editor.isActive(tool.mark)}
            onClick={() => tool.run(editor)}
          />
        ))}
        <IconButton
          icon="link"
          label={labels.link}
          variant="ghost"
          size="sm"
          active={editor.isActive("link")}
          onClick={() => setLinking(!linking)}
        />
      </div>
      {linking ? <LinkForm editor={editor} labels={labels} onDone={() => setLinking(false)} /> : null}
    </div>
  );
}

/** What is in the box now, whether it may be sent, and how many characters are too many. */
function useDraft(editor: Editor | null, allowEmpty: boolean) {
  const document = editor ? toRichDocument(editor.getJSON() as EditorNode) : { v: 1 as const, blocks: [] };
  const text = visibleText(document);
  const over = Math.max(0, [...text].length - MAX_MESSAGE_CHARS);
  const empty = text.trim() === "";
  return { document, over, empty, canSend: over === 0 && (!empty || allowEmpty) };
}

interface ToolRowProps {
  props: ChatComposerProps;
  editor: Editor | null;
  over: number;
  canSend: boolean;
  formatting: boolean;
  onFormatting: () => void;
  onSend: () => void;
}

function ToolRow({ props, editor, over, canSend, formatting, onFormatting, onSend }: ToolRowProps) {
  const { labels, tooManyLabel, emoji, onEmojiUsed, tools } = props;
  const [picking, setPicking] = useState(false);
  return (
    <>
      {picking ? (
        <div>
          <EmojiPicker
            {...emoji}
            onPick={(picked) => {
              editor?.chain().focus().insertContent(picked).run();
              onEmojiUsed?.(picked);
              setPicking(false);
            }}
          />
        </div>
      ) : null}
      <div className="flex items-center gap-0.5">
        <IconButton
          icon="format"
          label={labels.format}
          variant="ghost"
          size="sm"
          active={formatting}
          onClick={onFormatting}
        />
        <IconButton
          icon="smile"
          label={labels.emoji}
          variant="ghost"
          size="sm"
          active={picking}
          onClick={() => setPicking(!picking)}
        />
        {tools}
        <span className="flex-1" />
        {over > 0 ? (
          <span role="status" className="text-[12px] font-semibold text-danger">
            {tooManyLabel(over)}
          </span>
        ) : null}
        <IconButton icon="send" label={labels.send} variant="ghost" size="sm" disabled={!canSend} onClick={onSend} />
      </div>
    </>
  );
}

const EDITOR_CLASSES =
  "max-h-40 min-h-11 overflow-y-auto px-1.5 py-1 text-[14px] text-ink [&_.ProseMirror]:outline-none [&_.ProseMirror_pre]:rounded-sm [&_.ProseMirror_pre]:bg-stage [&_.ProseMirror_pre]:p-2 [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-stage-ink [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-ink-subtle [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]";

export function ChatComposer(props: ChatComposerProps) {
  const { labels, onSend, allowEmpty = false, above, onEscape } = props;
  const send = useRef<() => void>(() => undefined);
  const escape = useRef(onEscape);
  const editor = useComposerEditor(labels, send, escape);
  const [formatting, setFormatting] = useState(false);
  const draft = useDraft(editor, allowEmpty);
  const submit = () => {
    if (!editor || !draft.canSend) return;
    onSend(draft.empty ? { v: 1, blocks: [] } : draft.document);
    editor.commands.clearContent(true);
  };
  // The editor's keys call the newest versions (set after each render).
  useEffect(() => {
    send.current = submit;
    escape.current = onEscape;
  });
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line-strong bg-surface-sunken p-2">
      {above}
      {editor && formatting ? <FormatBar editor={editor} labels={labels} /> : null}
      <EditorContent editor={editor} className={cx(EDITOR_CLASSES, FOCUS_RING)} />
      <ToolRow
        props={props}
        editor={editor}
        over={draft.over}
        canSend={draft.canSend}
        formatting={formatting}
        onFormatting={() => setFormatting(!formatting)}
        onSend={submit}
      />
    </div>
  );
}
