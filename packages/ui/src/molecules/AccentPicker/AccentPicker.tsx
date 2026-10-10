// AccentPicker (molecule): the eight accent colors as round swatches; the chosen one has a ring and a
// check mark. A radio group: Tab reaches it once, arrow keys change the choice. The app applies the
// choice by setting data-accent on <html>.
import type { CSSProperties } from "react";
import { ACCENTS, type Accent } from "@meetapp/design-tokens";
import { Icon } from "../../atoms/Icon/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import { useRadioGroup } from "../../lib/useRadioGroup.ts";

export interface AccentPickerProps {
  value: Accent;
  /** Names the group, e.g. "Accent color". */
  label: string;
  /** Translated color names: { sky: "Sky blue", blue: "Blue", … }. */
  labels: Record<Accent, string>;
  onChange: (value: Accent) => void;
  className?: string;
}

/** Each swatch shows its own accent from the tokens, whatever accent is active. */
function swatchColors(accent: Accent): CSSProperties {
  return { "--sw": `var(--accent-${accent})`, "--sw-on": `var(--on-accent-${accent})` } as CSSProperties;
}

export function AccentPicker({ value, label, labels, onChange, className }: AccentPickerProps) {
  const itemProps = useRadioGroup(ACCENTS, value, onChange);
  return (
    <div role="radiogroup" aria-label={label} className={cx("flex flex-wrap gap-2.5", className)}>
      {ACCENTS.map((accent, index) => {
        const isChosen = accent === value;
        return (
          <button
            key={accent}
            type="button"
            {...itemProps(accent, index)}
            aria-label={labels[accent]}
            title={labels[accent]}
            style={swatchColors(accent)}
            className={cx(
              "grid size-8.5 cursor-pointer place-items-center rounded-full border-0 bg-(--sw) text-(--sw-on)",
              isChosen ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : "inset-ring inset-ring-ink/8",
              FOCUS_RING,
            )}
          >
            {isChosen ? <Icon name="check" size={16} /> : null}
          </button>
        );
      })}
    </div>
  );
}
