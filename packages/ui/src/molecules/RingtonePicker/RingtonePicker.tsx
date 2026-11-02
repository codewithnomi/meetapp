// RingtonePicker (molecule): the 5 ringtones as radio choices, each with a play button, and the ring
// volume (F15 AC-F15-32, approved canvas Settings → Calls). The page makes the sound and saves the choice.
import { useId } from "react";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface RingtoneOption {
  id: number;
  name: string;
  hint: string;
  /** "Play Chime". */
  playLabel: string;
}

export interface RingtonePickerProps {
  legend: string;
  options: RingtoneOption[];
  value: number;
  onChange: (id: number) => void;
  onPlay: (id: number) => void;
  volumeLabel: string;
  volume: number;
  onVolume: (volume: number) => void;
}

function Choice({ option, group, picker }: { option: RingtoneOption; group: string; picker: RingtonePickerProps }) {
  const id = `${group}-${String(option.id)}`;
  const chosen = option.id === picker.value;
  return (
    <div
      className={cx(
        "flex min-h-13 items-center gap-3 rounded-md border px-3 py-1.5",
        chosen ? "border-accent bg-accent-soft" : "border-line",
      )}
    >
      <input
        type="radio"
        id={id}
        name={group}
        checked={chosen}
        onChange={() => picker.onChange(option.id)}
        className={cx("size-4.5 accent-[var(--accent)]", FOCUS_RING)}
      />
      <label htmlFor={id} className="flex flex-1 flex-col">
        <span className="font-semibold">{option.name}</span>
        <span className="text-[12px] text-ink-muted">{option.hint}</span>
      </label>
      <IconButton
        icon="play"
        label={option.playLabel}
        variant="ghost"
        size="sm"
        onClick={() => picker.onPlay(option.id)}
      />
    </div>
  );
}

export function RingtonePicker(props: RingtonePickerProps) {
  const name = useId();
  const volumeId = useId();
  return (
    <div className="flex max-w-140 flex-col gap-5 text-ink">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-[15px] font-semibold">{props.legend}</legend>
        {props.options.map((option) => (
          <Choice key={option.id} option={option} group={name} picker={props} />
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={volumeId} className="text-[15px] font-semibold">
          {props.volumeLabel}
        </label>
        <input
          id={volumeId}
          type="range"
          min={0}
          max={100}
          value={props.volume}
          onChange={(event) => props.onVolume(Number(event.target.value))}
          aria-valuetext={`${String(props.volume)}%`}
          className={cx("accent-[var(--accent)]", FOCUS_RING)}
        />
      </div>
    </div>
  );
}
