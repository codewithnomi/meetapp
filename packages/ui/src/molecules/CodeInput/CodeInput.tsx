// CodeInput (molecule): the 6 boxes for an emailed code (F01 design.md section 2, approved canvas
// "Enter the code"). Typing a digit moves on, Backspace on an empty box moves back, arrow keys move,
// and pasting the whole code fills every box. Only digits are accepted. The group is named by its
// legend; each box has its own label for screen readers ("Digit 2 of 6").
import { useRef, type ChangeEvent, type ClipboardEvent, type FocusEvent, type KeyboardEvent } from "react";
import { cx } from "../../lib/cx.ts";

export interface CodeInputProps {
  /** Unique on the page; the boxes and the message are linked through it. */
  id: string;
  /** The visible name of the group, e.g. "Code". */
  label: string;
  /** Each box's name for screen readers, e.g. (2, 6) => "Digit 2 of 6". */
  digitLabel: (position: number, length: number) => string;
  /** The digits typed so far (0 to `length` characters). */
  value: string;
  onChange: (value: string) => void;
  length?: number;
  hint?: string;
  /** Says what went wrong and how to fix it; replaces the hint. */
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

const digitsOnly = (text: string) => text.replace(/\D/g, "");

/** Typing, deleting, moving and pasting across the boxes. */
function useCodeBoxes(value: string, onChange: (value: string) => void, length: number) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (index: number) => boxes.current[Math.max(0, Math.min(length - 1, index))]?.focus();
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  /** Writes `typed` from box `index` on (typing one digit, or pasting several). */
  const put = (index: number, typed: string) => {
    const clean = digitsOnly(typed);
    if (clean === "") return;
    onChange((value.slice(0, index) + clean).slice(0, length));
    focus(index + clean.length);
  };

  const handlers = (index: number) => ({
    ref: (element: HTMLInputElement | null) => {
      boxes.current[index] = element;
    },
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const typed = event.target.value;
      if (typed === "") onChange(value.slice(0, index));
      else put(index, typed.replace(digits[index] ?? "", "") || typed);
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Backspace" && digits[index] === "") {
        event.preventDefault();
        onChange(value.slice(0, Math.max(0, index - 1)));
        focus(index - 1);
      } else if (event.key === "ArrowLeft") focus(index - 1);
      else if (event.key === "ArrowRight") focus(index + 1);
    },
    onPaste: (event: ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();
      put(index, event.clipboardData.getData("text"));
    },
    onFocus: (event: FocusEvent<HTMLInputElement>) => event.target.select(),
  });
  return { digits, handlers };
}

const BOX = cx(
  "box-border h-14 w-full rounded-md border bg-surface-sunken text-center font-mono text-[24px] font-semibold text-ink",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function CodeInput(props: CodeInputProps) {
  const { id, label, digitLabel, value, onChange, length = 6, hint, error, disabled, autoFocus, className } = props;
  const { digits, handlers } = useCodeBoxes(value, onChange, length);
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <fieldset
      className={cx("m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0", className)}
      aria-describedby={messageId}
      disabled={disabled}
    >
      <legend className="mb-2.5 p-0 text-[13px] font-[550] text-ink">{label}</legend>
      <div className="grid grid-cols-6 gap-2">
        {digits.map((digit, index) => (
          <input
            // The boxes never reorder, so their position is a stable key.
            key={`${id}-${String(index)}`}
            {...handlers(index)}
            id={index === 0 ? id : `${id}-${String(index + 1)}`}
            aria-label={digitLabel(index + 1, length)}
            aria-invalid={error ? true : undefined}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the code screen exists only to type the code
            autoFocus={autoFocus === true && index === 0}
            value={digit}
            className={cx(BOX, error ? "border-danger" : "border-line-strong")}
          />
        ))}
      </div>
      {error || hint ? (
        <p id={messageId} className={cx("m-0 text-[13px]", error ? "font-medium text-danger" : "text-ink-muted")}>
          {error || hint}
        </p>
      ) : null}
    </fieldset>
  );
}
