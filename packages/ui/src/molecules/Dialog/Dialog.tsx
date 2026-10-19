// Dialog (molecule): a window over the screen, as on the approved "Create a workspace" canvas: a dimmed
// background, a raised card with `radius-xl`, a title, a short description and a Close button. Radix's
// dialog keeps keyboard focus inside while open, closes on Escape and returns focus where it was. The
// content (a form, buttons) is the caller's. All words arrive as props.
import * as RadixDialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { cx } from "../../lib/cx.ts";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already translated. */
  title: string;
  description: string;
  closeLabel: string;
  /** The id of the field to focus when the dialog opens; without it, the first focusable element. */
  initialFocusId?: string;
  /** Read by screen readers but not shown, when the content shows the same words elsewhere. */
  hideDescription?: boolean;
  /**
   * The id of the element to focus after closing, when the one that opened the dialog can't take it back
   * (e.g. it was busy and disabled meanwhile). Otherwise focus returns to the element focused at opening.
   */
  returnFocusId?: string;
  /** Width: md 520px (forms), lg 620px (Meeting options), xl 720px (Choose what to share). */
  size?: "md" | "lg" | "xl";
  children: ReactNode;
}

const WIDTHS = { md: "max-w-130", lg: "max-w-155", xl: "max-w-180" } as const;

/** Focus on opening (`initialFocusId`, else the first focusable) and back on closing (AC-F02-44). */
function useFocusMoves(initialFocusId: string | undefined, returnFocusId: string | undefined) {
  // Where focus was as the dialog opened (the button that opened it), to give it back (AC-F02-44).
  const opener = useRef<HTMLElement | null>(null);
  const focusField = (event: Event) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const field = initialFocusId ? document.getElementById(initialFocusId) : null;
    if (!field) return;
    event.preventDefault();
    field.focus();
  };
  const giveFocusBack = (event: Event) => {
    const target = (returnFocusId ? document.getElementById(returnFocusId) : null) ?? opener.current;
    if (!target?.isConnected || target === document.body) return;
    event.preventDefault();
    target.focus();
  };
  return { focusField, giveFocusBack };
}

export function Dialog(props: DialogProps) {
  const {
    open,
    onOpenChange,
    title,
    description,
    closeLabel,
    initialFocusId,
    returnFocusId,
    size = "md",
    hideDescription = false,
  } = props;
  const { children } = props;
  const { focusField, giveFocusBack } = useFocusMoves(initialFocusId, returnFocusId);
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/35" />
        <RadixDialog.Content
          onOpenAutoFocus={focusField}
          onCloseAutoFocus={giveFocusBack}
          className={cx(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-6 overflow-y-auto rounded-xl bg-surface-raised p-8 text-ink shadow-2",
            WIDTHS[size],
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <RadixDialog.Title className="m-0 text-[22px] leading-7 font-bold">{title}</RadixDialog.Title>
              <RadixDialog.Description
                className={cx("m-0 leading-[22px] text-ink-muted", hideDescription && "sr-only")}
              >
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
