// HistoryChoice (molecule): what new people in a group may see (AC-F14-17), as on the approved canvas
// (F14Group): no history, the last few days (1–365), or all history (the default, as in Teams). Real
// radio buttons in a fieldset; the days field appears with its option.
import { useId } from "react";
import { cx } from "../../lib/cx.ts";

export type History = { from: "none" } | { from: "days"; days: number } | { from: "all" };

export interface HistoryChoiceProps {
  /** "What can Hina see?". */
  legend: string;
  labels: { none: string; days: string; all: string; daysField: string };
  value: History;
  onChange: (value: History) => void;
  /** Shown under the days field when it is out of range: "Choose 1 to 365 days". */
  daysError?: string | undefined;
}

const KEYS = ["none", "days", "all"] as const;

function DaysField(props: {
  id: string;
  label: string;
  days: number;
  error: string | undefined;
  onChange: (value: History) => void;
}) {
  const { id, error } = props;
  return (
    <div className="flex flex-col gap-1 pl-10">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-[14px]">
          {props.label}
        </label>
        <input
          id={id}
          type="number"
          min={1}
          max={365}
          inputMode="numeric"
          value={props.days}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            props.onChange({ from: "days", days: Number(event.target.value) });
          }}
          className="box-border h-10 w-20 rounded-full border border-line-strong bg-surface px-3 text-ink"
        />
      </div>
      {error ? (
        <span id={`${id}-error`} className="text-[13px] text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function HistoryChoice({ legend, labels, value, onChange, daysError }: HistoryChoiceProps) {
  const name = useId();
  const daysId = useId();
  const days = value.from === "days" ? value.days : 7;
  const pick = (key: (typeof KEYS)[number]) => {
    onChange(key === "days" ? { from: "days", days } : { from: key });
  };
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-[14px] font-semibold">{legend}</legend>
      {KEYS.map((key) => (
        <label
          key={key}
          className={cx(
            "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3 text-[14px]",
            value.from === key
              ? "border-accent bg-accent-soft font-semibold text-accent-text"
              : "border-line-strong text-ink",
          )}
        >
          <input
            type="radio"
            name={name}
            checked={value.from === key}
            onChange={() => {
              pick(key);
            }}
            className="size-4.5 accent-[var(--accent)]"
          />
          {labels[key]}
        </label>
      ))}
      {value.from === "days" ? (
        <DaysField id={daysId} label={labels.daysField} days={value.days} error={daysError} onChange={onChange} />
      ) : null}
    </fieldset>
  );
}
