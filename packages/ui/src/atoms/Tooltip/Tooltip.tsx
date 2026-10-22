// Tooltip (atom): a short label on hover and keyboard focus, mainly to name icon-only buttons.
// Built on Radix: it is linked to its trigger with aria-describedby and closes with Escape.
import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactElement } from "react";

export interface TooltipProps {
  /** Already translated; repeats a name, never new information. */
  label: string;
  /** "right": beside an item in the folded side menu (F14). */
  side?: "top" | "bottom" | "right";
  /** Force open (for previews); normally hover/focus opens it. */
  open?: boolean;
  /** The trigger; it must be focusable (usually a button). */
  children: ReactElement;
}

export function Tooltip({ label, side = "top", open, children }: TooltipProps) {
  return (
    // Shows at once on hover or focus, fading in over 120 ms, like the design system's tooltip. The fade runs
    // only while open: an animation on the closed state kept closed tooltips on the page, catching Escape.
    <RadixTooltip.Provider delayDuration={0}>
      <RadixTooltip.Root {...(open === undefined ? {} : { open })}>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={8}
            className="z-50 data-[state=delayed-open]:animate-[ma-fade-in_120ms_ease-out] data-[state=instant-open]:animate-[ma-fade-in_120ms_ease-out] whitespace-nowrap rounded-sm bg-ink px-2.5 py-1.5 text-[12px] font-medium leading-4 text-bg shadow-2 motion-reduce:animate-none"
          >
            {label}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
