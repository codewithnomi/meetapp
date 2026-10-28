// OtherDeviceBar (molecule): "You're in a call on another device" (F15 AC-F15-33, design 3.8), shown in a
// window that isn't in the call: the call's name, Join on this device and Transfer to this device. While
// one is being done both buttons wait; a failure shows its message with Retry. All words arrive as props.
import { Button } from "../../atoms/Button/index.ts";

interface Choice {
  label: string;
  onClick: () => void;
}

export interface OtherDeviceBarProps {
  /** The bar's name for screen readers: "Call on another device". */
  label: string;
  /** "You're in a call on another device". */
  title: string;
  /** The call: "Release team". */
  callTitle: string;
  join: Choice;
  transfer: Choice;
  /** Set while joining or moving the call: "Joining…". */
  pendingText?: string | undefined;
  /** Set when it failed: the message and Retry. */
  error?: { text: string; retry: Choice } | undefined;
}

export function OtherDeviceBar(props: OtherDeviceBarProps) {
  const pending = props.pendingText !== undefined;
  return (
    <section
      aria-label={props.label}
      aria-busy={pending || undefined}
      className="flex flex-wrap items-center gap-3 rounded-xl bg-stage px-4 py-3 text-stage-ink shadow-2"
    >
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{props.title}</span>
        <span className="truncate text-[13px] opacity-85">{props.callTitle}</span>
      </span>
      {props.error ? (
        <span role="alert" className="flex items-center gap-2 text-[13px]">
          {props.error.text}
          <Button variant="secondary" size="sm" onClick={props.error.retry.onClick}>
            {props.error.retry.label}
          </Button>
        </span>
      ) : null}
      {pending ? (
        <span role="status" className="text-[13px]">
          {props.pendingText}
        </span>
      ) : null}
      <Button variant="secondary" disabled={pending} onClick={props.join.onClick}>
        {props.join.label}
      </Button>
      <Button disabled={pending} onClick={props.transfer.onClick}>
        {props.transfer.label}
      </Button>
    </section>
  );
}
