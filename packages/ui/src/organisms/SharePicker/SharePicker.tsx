// SharePicker (organism): the "Choose what to share" dialog of the approved screen: Whole screen or One
// window, the screens or windows with small previews (one chosen; arrow keys move between them), the
// note that everyone will see it and that computer sound isn't shared, then Cancel and Share. When
// macOS doesn't allow screen recording, the "Allow screen recording" message shows instead (AC-F02-25).
// All words arrive as props; the list of sources comes from the desktop app.
import { Button } from "../../atoms/Button/index.ts";
import { Spinner } from "../../atoms/Spinner/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import { useRadioGroup } from "../../lib/useRadioGroup.ts";
import { Dialog } from "../../molecules/Dialog/index.ts";
import { MessageCard, type MessageCardProps } from "../../molecules/MessageCard/index.ts";
import { SegmentedControl } from "../../molecules/SegmentedControl/index.ts";

export type ShareKind = "screen" | "window";

export interface ShareSource {
  id: string;
  name: string;
  /** A small preview as a data: address. */
  thumbnail: string;
}

export interface SharePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  /** "Everyone in the meeting will see it. … Sound from your computer isn't shared." */
  note: string;
  kind: {
    label: string;
    value: ShareKind;
    options: { value: ShareKind; label: string }[];
    onChange: (kind: ShareKind) => void;
  };
  /** Names the list of sources: "Screens" or "Windows". */
  sourcesLabel: string;
  sources: ShareSource[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** While the list is being made: "Finding screens". */
  loadingLabel?: string | undefined;
  emptyText: string;
  /** macOS doesn't allow screen recording: this message replaces the list. */
  blocked?: Omit<MessageCardProps, "live" | "headingLevel" | "className"> | undefined;
  cancelLabel: string;
  share: { label: string; onClick: () => void };
}

function Sources({
  label,
  sources,
  selectedId,
  onSelect,
}: {
  label: string;
  sources: ShareSource[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const ids = sources.map((source) => source.id);
  const itemProps = useRadioGroup(ids, selectedId ?? "", onSelect);
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {sources.map((source, index) => (
        <button
          key={source.id}
          type="button"
          {...itemProps(source.id, index)}
          className={cx(
            "flex cursor-pointer flex-col gap-2 rounded-md border-2 bg-transparent p-2 text-left text-ink",
            source.id === selectedId ? "border-accent" : "border-transparent hover:bg-surface-sunken",
            FOCUS_RING,
          )}
        >
          <img
            src={source.thumbnail}
            alt=""
            className="aspect-[16/10] w-full rounded-sm bg-surface-sunken object-cover"
          />
          <span className="text-[14px] font-[550]">{source.name}</span>
        </button>
      ))}
    </div>
  );
}

function Body(props: SharePickerProps) {
  const { blocked, loadingLabel, sources, emptyText } = props;
  if (blocked) return <MessageCard {...blocked} headingLevel={2} />;
  if (loadingLabel)
    return (
      <div className="grid min-h-40 place-items-center">
        <Spinner size={24} label={loadingLabel} />
      </div>
    );
  if (sources.length === 0) return <p className="m-0 text-ink-muted">{emptyText}</p>;
  return (
    <Sources label={props.sourcesLabel} sources={sources} selectedId={props.selectedId} onSelect={props.onSelect} />
  );
}

export function SharePicker(props: SharePickerProps) {
  const { open, onOpenChange, title, closeLabel, note, kind, blocked, cancelLabel, share, selectedId } = props;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={note}
      hideDescription
      closeLabel={closeLabel}
      size="xl"
    >
      {blocked ? null : (
        <SegmentedControl
          label={kind.label}
          options={kind.options}
          value={kind.value}
          onChange={kind.onChange}
          className="self-start"
        />
      )}
      <Body {...props} />
      {/* The note is the dialog's description for screen readers (hidden there) and shown here, under
          the list, where the approved screen puts it. */}
      {blocked ? null : (
        <p aria-hidden="true" className="m-0 text-[13px] text-ink-muted">
          {note}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2.5">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        {blocked ? null : (
          <Button icon="screen" disabled={selectedId === undefined} onClick={share.onClick}>
            {share.label}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
