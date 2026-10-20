// StickerPicker (molecule): MeetApp's own stickers to send (F03 AC-F03-26, approved screen "Chat:
// pickers"). Pressing one sends it. Names and words arrive as props.
import { Sticker } from "../../atoms/Sticker/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface StickerPickerProps {
  /** "Stickers" (names the group). */
  label: string;
  stickers: { name: string; text: string; label: string }[];
  onPick: (name: string) => void;
}

export function StickerPicker({ label, stickers, onPick }: StickerPickerProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid max-h-70 grid-cols-4 gap-2 overflow-y-auto rounded-md border border-line bg-surface-raised p-2 shadow-2"
    >
      {stickers.map((sticker) => (
        <button
          key={sticker.name}
          type="button"
          aria-label={sticker.label}
          onClick={() => onPick(sticker.name)}
          className={cx("cursor-pointer rounded-lg border-0 bg-transparent p-0", FOCUS_RING)}
        >
          <Sticker name={sticker.name} text={sticker.text} label={sticker.label} size="sm" />
        </button>
      ))}
    </div>
  );
}
