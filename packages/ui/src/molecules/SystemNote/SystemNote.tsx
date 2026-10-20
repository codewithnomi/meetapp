// SystemNote (molecule): a small centred note in the chat, such as "Aisha Khan pinned a message" or
// "Aisha Khan turned chat off" (F03 AC-F03-19, 37). The text arrives translated.
export interface SystemNoteProps {
  text: string;
}

export function SystemNote({ text }: SystemNoteProps) {
  return <p className="m-0 self-center text-center text-[12px] leading-4 text-ink-muted">{text}</p>;
}
