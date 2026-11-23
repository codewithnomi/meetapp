// RepeatPicker (molecule): how a meeting repeats (approved "Calendar: New meeting" screen, F13 AC-F13-10,
// 11): a menu with the choices, day buttons when it repeats weekly, and an "End repeat" date when it
// repeats at all. All words and choices arrive as props.
import { Input } from "../../atoms/Input/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface RepeatChoice<K extends string> {
  value: K;
  label: string;
}

export interface RepeatPickerProps<K extends string, D extends string> {
  id: string;
  label: string;
  choices: readonly RepeatChoice<K>[];
  kind: K;
  /** The choice that never repeats ("none") and the one that shows day buttons ("weekly"). */
  noneKind: K;
  weeklyKind: K;
  days: { label: string; days: readonly { value: D; short: string; full: string }[]; chosen: readonly D[] };
  until: { label: string; hint?: string | undefined; value: string; error?: string | undefined };
  onChange: (value: { kind: K; days: D[]; until: string }) => void;
}

const BOX =
  "h-10 w-full max-w-80 cursor-pointer rounded-full border border-line-strong bg-surface px-4 font-[inherit] text-[14px] text-ink";

function DayButtons<D extends string>({
  days,
  onToggle,
}: {
  days: RepeatPickerProps<string, D>["days"];
  onToggle: (day: D) => void;
}) {
  return (
    <div role="group" aria-label={days.label} className="flex flex-wrap gap-1.5 px-1">
      {days.days.map((day) => {
        const on = days.chosen.includes(day.value);
        return (
          <button
            key={day.value}
            type="button"
            aria-pressed={on}
            aria-label={day.full}
            onClick={() => onToggle(day.value)}
            className={cx(
              "size-9 cursor-pointer rounded-full border font-[inherit] text-[13px]",
              on ? "border-accent bg-accent font-bold text-on-accent" : "border-line-strong bg-surface text-ink",
              FOCUS_RING,
            )}
          >
            {day.short}
          </button>
        );
      })}
    </div>
  );
}

export function RepeatPicker<K extends string, D extends string>(props: RepeatPickerProps<K, D>) {
  const { id, label, choices, kind, noneKind, weeklyKind, days, until, onChange } = props;
  const change = (next: Partial<{ kind: K; days: D[]; until: string }>) =>
    onChange({ kind, days: [...days.chosen], until: until.value, ...next });
  const toggle = (day: D) =>
    change({ days: days.chosen.includes(day) ? days.chosen.filter((d) => d !== day) : [...days.chosen, day] });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="px-4 text-[13px] font-[550] text-ink">
          {label}
        </label>
        <select
          id={id}
          value={kind}
          onChange={(e) => change({ kind: e.target.value as K })}
          className={cx(BOX, FOCUS_RING)}
        >
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </div>
      {kind === weeklyKind ? <DayButtons days={days} onToggle={toggle} /> : null}
      {kind === noneKind ? null : (
        <Input
          id={`${id}-until`}
          type="date"
          label={until.label}
          value={until.value}
          {...(until.hint ? { hint: until.hint } : {})}
          {...(until.error ? { error: until.error } : {})}
          onChange={(e) => change({ until: e.target.value })}
          className="max-w-80"
        />
      )}
    </div>
  );
}
