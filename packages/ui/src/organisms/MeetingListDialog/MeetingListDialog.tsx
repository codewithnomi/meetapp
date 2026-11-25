// The meetings behind "+N more" (AC-F13-01): a short list in a dialog; choosing one opens its details.
import { MeetingBlock, type MeetingBlockProps } from "../../molecules/MeetingBlock/index.ts";
import { Dialog } from "../../molecules/Dialog/index.ts";

export interface MeetingListItem extends Omit<MeetingBlockProps, "onOpen" | "compact" | "className" | "style"> {
  id: string;
}

export interface MeetingListDialogProps {
  title: string;
  closeLabel: string;
  meetings: MeetingListItem[];
  onOpen: (id: string) => void;
  onClose: () => void;
}

export function MeetingListDialog({ title, closeLabel, meetings, onOpen, onClose }: MeetingListDialogProps) {
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={title}
      hideDescription
      closeLabel={closeLabel}
    >
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {meetings.map(({ id, ...meeting }) => (
          <li key={id} className="flex">
            <MeetingBlock {...meeting} onOpen={() => onOpen(id)} className="flex-1" />
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
