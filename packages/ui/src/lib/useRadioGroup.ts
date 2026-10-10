// Keyboard behavior of a radio group (WAI-ARIA "radio group" pattern), shared by SegmentedControl and
// AccentPicker: Tab enters the group once, on the chosen option; the arrow keys, Home and End move to
// another option and choose it. In a right-to-left language (dir="rtl") ArrowLeft goes forward.
import { useRef, type KeyboardEvent } from "react";

type Step = (index: number, count: number) => number;
const next: Step = (i, n) => (i + 1) % n;
const previous: Step = (i, n) => (i - 1 + n) % n;

const STEP: Record<string, Step> = {
  ArrowRight: next,
  ArrowDown: next,
  ArrowLeft: previous,
  ArrowUp: previous,
  Home: () => 0,
  End: (_i, n) => n - 1,
};

function stepFor(key: string, el: HTMLElement): Step | undefined {
  const rtl = el.closest("[dir]")?.getAttribute("dir") === "rtl";
  if (rtl && key === "ArrowRight") return previous;
  if (rtl && key === "ArrowLeft") return next;
  return STEP[key];
}

export interface RadioItemProps {
  role: "radio";
  "aria-checked": boolean;
  tabIndex: 0 | -1;
  ref: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export function useRadioGroup<T extends string>(values: readonly T[], value: T, onChange: (value: T) => void) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // If the value matches no option, the first one takes the Tab stop so the group stays reachable.
  const tabStop = Math.max(values.indexOf(value), 0);

  return function itemProps(option: T, index: number): RadioItemProps {
    return {
      role: "radio",
      "aria-checked": option === value,
      tabIndex: index === tabStop ? 0 : -1,
      ref: (el) => {
        buttons.current[index] = el;
      },
      onClick: () => onChange(option),
      onKeyDown: (event) => {
        // Leave Alt/Ctrl/Cmd + arrow to the browser and the system (e.g. Alt+ArrowLeft = back).
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const step = stepFor(event.key, event.currentTarget);
        if (!step) return;
        event.preventDefault();
        const target = step(index, values.length);
        buttons.current[target]?.focus();
        const nextValue = values[target];
        if (nextValue !== undefined) onChange(nextValue);
      },
    };
  };
}
