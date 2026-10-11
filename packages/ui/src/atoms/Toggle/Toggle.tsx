// Toggle (atom): an on/off switch for settings that take effect at once. Built on Radix Switch, so it
// is a real `role="switch"` button that flips with Space and Enter. Controlled: the parent keeps
// `checked` and updates it in `onChange`.
import * as RadixSwitch from "@radix-ui/react-switch";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface ToggleProps {
  id: string;
  /** Names the setting, not the state: "AI notes for this meeting", not "Enable AI". */
  label: string;
  /** Extra explanation; when disabled, it says why. */
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  className?: string;
}

export function Toggle({ id, label, description, checked, disabled, onChange, className }: ToggleProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <div className={cx("flex items-center justify-between gap-4", className)}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="text-[14px] font-[550]">
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className="text-[12px] leading-4 text-ink-muted">
            {description}
          </span>
        ) : null}
      </span>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled ?? false}
        aria-describedby={descriptionId}
        className={cx(
          "group relative h-6.5 w-11 shrink-0 cursor-pointer rounded-full border border-line-strong bg-surface-sunken p-0",
          "transition-colors duration-150 data-[state=checked]:border-transparent data-[state=checked]:bg-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          FOCUS_RING,
        )}
      >
        <RadixSwitch.Thumb
          className={cx(
            "absolute top-0.75 start-0.75 block size-4.5 rounded-full bg-ink-muted transition-[translate,background-color] duration-150",
            "data-[state=checked]:translate-x-4.5 rtl:data-[state=checked]:-translate-x-4.5 data-[state=checked]:bg-on-accent motion-reduce:transition-none",
          )}
        />
      </RadixSwitch.Root>
    </div>
  );
}
