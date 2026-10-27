// BackgroundPicker (molecule): None, Blur and the built-in pictures as a grid of pressable tiles (F15
// AC-F15-30, approved canvas Settings → Devices), as one radio group (Tab once, arrows choose). The page applies it to the
// camera. When the computer can't run effects, the tiles are off and a note says why (AC-F15-31).
import { Icon } from "../../atoms/Icon/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import { useRadioGroup } from "../../lib/useRadioGroup.ts";

export interface BackgroundOption {
  id: string;
  name: string;
  kind: "none" | "blur" | "picture";
  /** For a picture: a small image shipped with the app. */
  imageUrl?: string | undefined;
}

export interface BackgroundPickerProps {
  legend: string;
  options: BackgroundOption[];
  value: string;
  onChange: (id: string) => void;
  /** "Made on this computer. If it slows your video, MeetApp turns it off and tells you." */
  hint?: string | undefined;
  /** Set when effects can't run on this computer: the tiles are off and this says why. */
  unavailable?: string | undefined;
}

function Thumb({ option }: { option: BackgroundOption }) {
  if (option.kind === "picture" && option.imageUrl) {
    return <img src={option.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />;
  }
  return (
    <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-surface-sunken text-ink-muted">
      <Icon name={option.kind === "blur" ? "sparkle" : "close"} size={22} />
    </span>
  );
}

export function BackgroundPicker({ legend, options, value, onChange, hint, unavailable }: BackgroundPickerProps) {
  const itemProps = useRadioGroup(
    options.map((option) => option.id),
    value,
    onChange,
  );
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" disabled={unavailable !== undefined}>
      <legend className="mb-2 p-0 text-[15px] font-semibold text-ink">{legend}</legend>
      <div role="radiogroup" aria-label={legend} className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
        {options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            {...itemProps(option.id, index)}
            className={cx(
              "relative flex h-16 cursor-pointer items-end overflow-hidden rounded-md border-2 p-0 disabled:cursor-not-allowed disabled:opacity-50",
              option.id === value ? "border-accent ring-2 ring-accent" : "border-line",
              FOCUS_RING,
            )}
          >
            <Thumb option={option} />
            <span className="relative w-full bg-stage-scrim px-1.5 py-0.5 text-left text-[11px] font-semibold text-stage-ink">
              {option.name}
            </span>
          </button>
        ))}
      </div>
      {unavailable ? (
        <p className="m-0 text-[12px] text-ink-muted">{unavailable}</p>
      ) : hint ? (
        <p className="m-0 text-[12px] text-ink-muted">{hint}</p>
      ) : null}
    </fieldset>
  );
}
