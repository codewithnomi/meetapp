// MeetingInfoPanel (organism): the Meeting info panel of the approved "Meeting: gallery" screen: the link
// with Copy, the meeting ID, passcode, organizer and workspace, Copy all details, and Meeting options for
// the organizer and co-organizers. "Copied" is read out after a copy. All words arrive as props.
import { Button } from "../../atoms/Button/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { SidePanel } from "../../molecules/SidePanel/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface MeetingDetail {
  /** "Meeting ID", "Passcode", "Organizer", "Workspace". */
  label: string;
  value: string;
  /** IDs and passcodes use the code font. */
  mono?: boolean;
}

export interface MeetingInfoPanelProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  link: { label: string; value: string; copyLabel: string; onCopy: () => void };
  details: MeetingDetail[];
  copyAll: { label: string; onClick: () => void };
  /** Only for the organizer and co-organizers. */
  options?: { label: string; onClick: () => void } | undefined;
  /** After a copy: "Copied". */
  status?: string | undefined;
}

export function MeetingInfoPanel(props: MeetingInfoPanelProps) {
  const { title, closeLabel, onClose, link, details, copyAll, options, status } = props;
  return (
    <SidePanel title={title} closeLabel={closeLabel} onClose={onClose} className="max-w-85 gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-[550] text-ink-muted">{link.label}</span>
        <div className="flex min-h-10 items-center gap-2 rounded-full bg-surface-sunken py-0 pr-1.5 pl-3.5">
          <span className="min-w-0 flex-1 truncate text-[13px]">{link.value}</span>
          <Button variant="ghost" size="sm" icon="copy" onClick={link.onCopy}>
            {link.copyLabel}
          </Button>
        </div>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
        {details.map((detail) => (
          <div key={detail.label} className="contents">
            <dt className="text-ink-muted">{detail.label}</dt>
            <dd className={cx("m-0 min-w-0 break-words", detail.mono && "font-mono font-semibold")}>{detail.value}</dd>
          </div>
        ))}
      </dl>
      <Button variant="secondary" icon="copy" onClick={copyAll.onClick}>
        {copyAll.label}
      </Button>
      {options ? (
        <button
          type="button"
          onClick={options.onClick}
          className={cx(
            "inline-flex cursor-pointer items-center gap-2 self-start rounded-sm text-[14px] font-semibold text-accent-text hover:text-ink",
            FOCUS_RING,
          )}
        >
          <Icon name="sliders" size={18} />
          {options.label}
        </button>
      ) : null}
      <p role="status" className="m-0 min-h-5 text-[13px] text-ink-muted">
        {status ?? ""}
      </p>
    </SidePanel>
  );
}
