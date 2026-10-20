// Sample labels for the ChatComposer stories and tests (the app passes translated words).
import type { ChatComposerLabels } from "./ChatComposer.tsx";

export const SAMPLE_LABELS: ChatComposerLabels = {
  placeholder: "Message everyone",
  send: "Send",
  format: "Format",
  emoji: "Emoji",
  formatting: "Formatting",
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  strike: "Strikethrough",
  bulletList: "Bulleted list",
  orderedList: "Numbered list",
  quote: "Quote",
  link: "Insert link",
  linkAddress: "Link address",
  applyLink: "Add link",
  code: "Inline code",
  codeBlock: "Code block",
};

export const SAMPLE_EMOJI = {
  dataUrl: "/emojibase",
  recent: ["👍", "🎉"],
  labels: {
    search: "Search emoji",
    recent: "Recently used",
    loading: "Loading…",
    empty: "No emoji found",
    skinTone: "Skin tone",
  },
};
