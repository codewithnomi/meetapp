// Dialog (molecule): a window over the screen, as on the approved "Create a workspace" canvas: a dimmed
// background, a raised card with `radius-xl`, a title, a short description and a Close button. Radix's
// dialog keeps keyboard focus inside while open, closes on Escape and returns focus where it was. The
// content (a form, buttons) is the caller's. All words arrive as props.
import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { IconButton } from "../../atoms/IconButton/index.ts";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already translated. */
  title: string;
  description: string;
  closeLabel: string;
  /** The id of the field to focus when the dialog opens; without it, the first focusable element. */
  initialFocusId?: string;
  children: ReactNode;
}

export function Dialog(props: DialogProps) {
  const { open, onOpenChange, title, description, closeLabel, initialFocusId, children } = props;
  const focusField = (event: Event) => {
    const field = initialFocusId ? document.getElementById(initialFocusId) : null;
    if (!field) return;
    event.preventDefault();
    field.focus();
  };
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/35" />
        <RadixDialog.Content
          onOpenAutoFocus={focusField}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-130 -translate-x-1/2 -translate-y-1/2 flex-col gap-6 overflow-y-auto rounded-xl bg-surface-raised p-8 text-ink shadow-2"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <RadixDialog.Title className="m-0 text-[22px] leading-7 font-bold">{title}</RadixDialog.Title>
              <RadixDialog.Description className="m-0 leading-[22px] text-ink-muted">
                {description}
              </RadixDialog.Description>
            </div>
            <RadixDialog.Close asChild>
              <IconButton icon="close" label={closeLabel} variant="ghost" size="sm" />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
