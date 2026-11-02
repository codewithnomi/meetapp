// TypingIndicator (molecule): "Bilal is typing…" under the messages (AC-F14-23), with three gently
// pulsing dots (still when the person prefers less motion). Read out politely when it appears.
export interface TypingIndicatorProps {
  /** Already translated, or empty when nobody is typing: "Bilal is typing…", "Bilal and Sara are typing…". */
  text: string;
}

export function TypingIndicator({ text }: TypingIndicatorProps) {
  return (
    <p role="status" aria-live="polite" className="m-0 flex min-h-5 items-center gap-2 text-[12px] text-ink-muted">
      {text ? (
        <>
          <span aria-hidden="true" className="flex gap-0.75">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                style={{ animationDelay: `${String(delay)}ms` }}
                className="size-1.5 animate-pulse rounded-full bg-ink-muted motion-reduce:animate-none"
              />
            ))}
          </span>
          {text}
        </>
      ) : null}
    </p>
  );
}
