// EmojiPicker (molecule): search and pick an emoji, with recently used ones first and skin tones (F03
// AC-F03-12, approved screen "Chat: pickers"). Built on Frimousse (D058); the emoji list comes from the
// app's own copy (`dataUrl`), never from a CDN. Words arrive as props.
import { EmojiPicker as Picker, type EmojiPickerListProps } from "frimousse";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface EmojiPickerProps {
  /** Where the app serves the emoji list, e.g. "/emojibase" (design 5.1). */
  dataUrl: string;
  onPick: (emoji: string) => void;
  /** Recently used emoji, newest first, shown above the full list. */
  recent: string[];
  labels: { search: string; recent: string; loading: string; empty: string; skinTone: string };
}

const listComponents: NonNullable<EmojiPickerListProps["components"]> = {
  CategoryHeader: ({ category, ...props }) => (
    <div {...props} className="bg-surface-raised px-1 pt-2 pb-1 text-[12px] font-semibold text-ink-muted">
      {category.label}
    </div>
  ),
  Row: ({ children, ...props }) => (
    <div {...props} className="flex gap-0.5">
      {children}
    </div>
  ),
  Emoji: ({ emoji, ...props }) => (
    <button
      {...props}
      className={cx("grid size-9 place-items-center rounded-md text-[22px]", emoji.isActive && "bg-surface-sunken")}
    >
      {emoji.emoji}
    </button>
  ),
};

export function EmojiPicker({ dataUrl, onPick, recent, labels }: EmojiPickerProps) {
  return (
    <Picker.Root
      emojibaseUrl={dataUrl}
      columns={9}
      onEmojiSelect={({ emoji }) => onPick(emoji)}
      className="flex h-80 w-full max-w-87 flex-col gap-2 rounded-md border border-line bg-surface-raised p-2 text-ink shadow-2"
    >
      <Picker.Search
        aria-label={labels.search}
        placeholder={labels.search}
        className={cx("h-10 rounded-full border border-line-strong bg-surface-sunken px-4 text-ink", FOCUS_RING)}
      />
      {recent.length > 0 ? (
        <section aria-label={labels.recent} className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-ink-muted">{labels.recent}</span>
          <div className="flex flex-wrap gap-0.5">
            {recent.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onPick(emoji)}
                className={cx(
                  "grid size-9 place-items-center rounded-md text-[22px] hover:bg-surface-sunken",
                  FOCUS_RING,
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <Picker.Viewport className="relative min-h-0 flex-1">
        <Picker.Loading className="p-3 text-[13px] text-ink-muted">{labels.loading}</Picker.Loading>
        <Picker.Empty className="p-3 text-[13px] text-ink-muted">{labels.empty}</Picker.Empty>
        <Picker.List components={listComponents} />
      </Picker.Viewport>
      <Picker.SkinToneSelector
        emoji="👋"
        aria-label={labels.skinTone}
        className={cx("self-start rounded-md p-1 text-[18px]", FOCUS_RING)}
      />
    </Picker.Root>
  );
}
