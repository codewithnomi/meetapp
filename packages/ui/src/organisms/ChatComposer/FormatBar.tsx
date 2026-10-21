// The message box's Format toolbar (part of ChatComposer, F03 AC-F03-15): bold, italic, underline,
// strike, lists, quote, link (http/https only, with its own address field), code and code block.
import type { Editor } from "@tiptap/react";
import { useState } from "react";
import { IconButton } from "../../atoms/IconButton/index.ts";
import type { IconName } from "../../atoms/Icon/index.ts";
import { Input } from "../../atoms/Input/index.ts";

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

export function FormatBar({ editor, labels }: { editor: Editor; labels: ChatComposerLabels }) {
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
