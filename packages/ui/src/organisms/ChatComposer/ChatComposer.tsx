// ChatComposer (organism): the message box of the approved "Chat" screen (F03 design.md 5.1): rich text
// with the Format toolbar (bold, italic, underline, strike, lists, quote, link, code, code block) and
// keyboard shortcuts, typing ``` for a code block, an emoji picker, room for more tools (files, GIFs,
// stickers, polls), and a counter near the 4,000-character limit. Enter sends; Shift+Enter starts a
// new line; in lists and code blocks Enter keeps its usual meaning and Ctrl/Cmd+Enter sends. What is
// sent is the stored message document (lib/rich-document.ts), so pasted extras never get through.

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, Extension, useEditor, type Editor } from "@tiptap/react";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { mentionExtension, type MentionBridge, type MentionMenu, type MentionPerson } from "./mentions.ts";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { OPENER, focusOpener, useCloseOnOutside } from "../../lib/useCloseOnOutside.ts";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import { toEditorDocument, toRichDocument, visibleText, type EditorNode } from "../../lib/rich-document.ts";
import type { RichDocument } from "../../molecules/MessageBody/index.ts";
import { FormatBar, type ChatComposerLabels } from "./FormatBar.tsx";

export type { ChatComposerLabels };

export const MAX_MESSAGE_CHARS = 4000;

export interface ChatComposerProps {
  labels: ChatComposerLabels;
  /** "212 characters too many" (translated by the page). */
  tooManyLabel: (over: number) => string;
  onSend: (document: RichDocument) => void;
  /** True when something else (files) may be sent without text. */
  allowEmpty?: boolean;
  /** Files still uploading: Send waits. */
  waiting?: boolean | undefined;
  /**
   * The emoji, GIF and sticker popup opened by the smiley button, above the box (as in Teams). It gets
   * `insert` to put a picked emoji into the text and `close` to shut the popup.
   */
  expressions: (insert: (emoji: string) => void, close: () => void) => ReactNode;
  /** A reply quote or waiting files, above the text. */
  above?: ReactNode;
  /** More tools after the emoji button: attach, GIF, sticker, poll. */
  tools?: ReactNode;
  onEscape?: (() => void) | undefined;
  /** A sent message being edited: the box starts with it (give the composer a new `key` per message). */
  initial?: RichDocument | undefined;
  /** Pictures or files pasted into the box (AC-F03-29). */
  onPasteFiles?: ((files: File[]) => void) | undefined;
  /** F14 @mentions: the chat's members matching what was typed after "@", and the list's name. */
  mentions?: { search: (query: string) => MentionPerson[]; listLabel: string } | undefined;
  /** F14 "is typing": called as the text changes (the page decides how often to tell others). */
  onTyping?: (() => void) | undefined;
  /** F14: the box takes the focus when a chat opens (as in Teams), so the keyboard can write at once. */
  focusOnOpen?: boolean | undefined;
  /** The box takes the focus again whenever this changes, e.g. the message a reply was started to. */
  focusWhen?: string | undefined;
}

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

/** The latest callbacks, read by the editor when a key is pressed or files are pasted. */
interface Latest {
  mentions?: MentionBridge | undefined;
  typing: { current: (() => void) | undefined };
  send: { current: () => void };
  escape: { current: (() => void) | undefined };
  pasteFiles: { current: ((files: File[]) => void) | undefined };
}

function useComposerEditor(
  { initial, focusOnOpen = false, focusWhen }: Pick<ChatComposerProps, "initial" | "focusOnOpen" | "focusWhen">,
  labels: ChatComposerLabels,
  latest: Latest,
) {
  const { send, escape, pasteFiles, mentions, typing } = latest;
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
      ...(mentions ? [mentionExtension(mentions)] : []),
    ],
    ...(initial ? { content: toEditorDocument(initial) as never, autofocus: "end" as const } : {}),
    ...(!initial && focusOnOpen ? { autofocus: "end" as const } : {}),
    editorProps: {
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        if (files.length === 0 || !pasteFiles.current) return false;
        pasteFiles.current(files);
        return true;
      },
      attributes: { "aria-label": labels.placeholder, role: "textbox", "aria-multiline": "true", spellcheck: "true" },
    },
    onUpdate: ({ transaction }) => {
      if (transaction.docChanged) typing.current?.();
      redraw((n) => n + 1);
    },
    onSelectionUpdate: () => redraw((n) => n + 1),
  });
  // Reply moves the keyboard to the box, as in Teams (F14 TC-F14-60).
  useEffect(() => {
    if (focusWhen) editor?.commands.focus("end");
  }, [editor, focusWhen]);
  return editor;
}

/** What is in the box now, whether it may be sent, and how many characters are too many. */
function useDraft(editor: Editor | null, allowEmpty: boolean, waiting: boolean) {
  const document = editor ? toRichDocument(editor.getJSON() as EditorNode) : { v: 1 as const, blocks: [] };
  const text = visibleText(document);
  const over = Math.max(0, [...text].length - MAX_MESSAGE_CHARS);
  const empty = text.trim() === "";
  return { document, over, empty, canSend: !waiting && over === 0 && (!empty || allowEmpty) };
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
  const { labels, tooManyLabel, expressions, tools } = props;
  const [picking, setPicking] = useState(false);
  const popup = useRef<HTMLDivElement>(null);
  useCloseOnOutside(picking, popup, () => setPicking(false));
  const insert = (picked: string) => {
    editor?.chain().focus().insertContent(picked).run();
    setPicking(false);
  };
  return (
    <>
      {picking ? (
        <div ref={popup} className="absolute right-0 bottom-full left-0 z-20 mb-2">
          {expressions(insert, () => (setPicking(false), focusOpener()))}
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
          {...OPENER}
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

/** The members matching "@…", above the box; the editor's keys move through it (mentions.ts). */
function MentionList({ menu, label }: { menu: MentionMenu; label: string }) {
  return (
    <ul
      role="listbox"
      aria-label={label}
      className="absolute bottom-full left-2 z-20 mb-2 flex min-w-60 list-none flex-col gap-0.5 rounded-md border border-line bg-surface-raised p-1.5 shadow-2"
    >
      {menu.people.map((person, index) => (
        <li
          key={person.id}
          role="option"
          aria-selected={index === menu.active}
          onMouseDown={(event) => {
            event.preventDefault();
            menu.pick(person);
          }}
          className={cx(
            "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-[14px] text-ink",
            index === menu.active && "bg-surface-sunken",
          )}
        >
          <Avatar name={person.name} size="sm" />
          {person.name}
        </li>
      ))}
    </ul>
  );
}

export function ChatComposer(props: ChatComposerProps) {
  const { labels, onSend, allowEmpty = false, above, onEscape } = props;
  const send = useRef<() => void>(() => undefined);
  const escape = useRef(onEscape);
  const pasteFiles = useRef(props.onPasteFiles);
  const typing = useRef(props.onTyping);
  const search = useRef(props.mentions?.search ?? (() => []));
  const [menu, setMenu] = useState<MentionMenu>();
  // Made once: the editor's extensions are fixed when it starts.
  const [bridge] = useState<MentionBridge | undefined>(() => (props.mentions ? { search, show: setMenu } : undefined));
  const editor = useComposerEditor(props, labels, { send, escape, pasteFiles, mentions: bridge, typing });
  const [formatting, setFormatting] = useState(false);
  const draft = useDraft(editor, allowEmpty, props.waiting === true);
  const submit = () => {
    if (!editor || !draft.canSend) return;
    onSend(draft.empty ? { v: 1, blocks: [] } : draft.document);
    editor.commands.clearContent(true);
  };
  // The editor's keys call the newest versions (set after each render).
  useEffect(() => {
    send.current = submit;
    escape.current = onEscape;
    pasteFiles.current = props.onPasteFiles;
    typing.current = props.onTyping;
    search.current = props.mentions?.search ?? (() => []);
  });
  return (
    <div className="relative flex flex-col gap-1.5 rounded-lg border border-line-strong bg-surface-sunken p-2">
      {menu && menu.people.length > 0 && props.mentions ? (
        <MentionList menu={menu} label={props.mentions.listLabel} />
      ) : null}
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
