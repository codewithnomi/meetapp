// SegmentedControl (molecule): two to four options side by side, one chosen (e.g. the theme: Light /
// Dark / Same as my computer). A radio group: Tab reaches it once, arrow keys change the choice.
import { Icon, type IconName } from "../../atoms/Icon/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import { useRadioGroup } from "../../lib/useRadioGroup.ts";

export interface SegmentedOption<T extends string> {
  value: T;
  /** Already translated. */
  label: string;
  icon?: IconName;
}

export interface SegmentedControlProps<T extends string> {
  /** Names the group for screen readers, e.g. "Theme". */
  label: string;
  /** Two to four; more than four belongs in a select menu. */
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const itemProps = useRadioGroup(
    options.map((option) => option.value),
    value,
    onChange,
  );
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("inline-flex gap-0.5 rounded-full border border-line bg-surface-sunken p-0.75", className)}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          {...itemProps(option.value, index)}
          className={cx(
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border-0 px-4 font-[inherit] text-[13px] font-[550]",
            option.value === value
              ? "bg-surface-raised text-ink shadow-1"
              : "bg-transparent text-ink-muted hover:text-ink",
            FOCUS_RING,
          )}
        >
          {option.icon ? <Icon name={option.icon} size={16} /> : null}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
