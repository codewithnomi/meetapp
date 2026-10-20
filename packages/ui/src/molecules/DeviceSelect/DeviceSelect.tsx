// DeviceSelect (molecule): a labelled, pill-shaped choice list from the approved "Pre-join", "Device
// settings" and "Meeting options" screens: camera, microphone, speakers, and the meeting's "who can"
// choices. A native <select>, so the keyboard and screen readers work as everywhere else. With no
// options it shows `emptyLabel` (e.g. "No camera found") and can't be opened.
import { useId, type ReactNode } from "react";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface SelectOption {
  value: string;
  /** Already translated, or the device's own name. */
  label: string;
}

export interface DeviceSelectProps {
  /** Already translated: "Camera", "Who can skip the lobby?". */
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Shown when there are no options. */
  emptyLabel?: string;
  /** Extra explanation under the list. */
  hint?: string;
  disabled?: boolean;
  /** Something under the list, such as the microphone level or "Test speakers". */
  children?: ReactNode;
  className?: string;
}

export function DeviceSelect(props: DeviceSelectProps) {
  const { label, value, options, onChange, emptyLabel, hint, disabled = false, children, className } = props;
  const id = useId();
  const empty = options.length === 0;
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-[550] text-ink">
        {label}
      </label>
      <select
        id={id}
        value={empty ? "" : value}
        disabled={disabled || empty}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          "h-10 min-w-0 cursor-pointer rounded-full border border-line-strong bg-surface-sunken px-3.5 text-[15px] text-ink",
          "disabled:cursor-not-allowed disabled:opacity-60",
          FOCUS_RING,
        )}
      >
        {empty ? <option value="">{emptyLabel ?? ""}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={`${id}-hint`} className="m-0 px-3.5 text-[12px] leading-4 text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}
