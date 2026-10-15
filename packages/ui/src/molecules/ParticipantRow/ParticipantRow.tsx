// ParticipantRow (molecule): one person in the meeting's participant list, as in the approved "Meeting:
// speaker view" screen (reworked from the design system's row for F02): photo or initials with the
// speaking ring, name and meeting role, then hand, microphone and camera, each with a spoken label so
// nothing relies on color or shape alone, and an actions menu holding only what the viewer may do. It
// renders a list item; the participant panel supplies the list. All words arrive as props.
import { ActionMenu, type MenuAction } from "../../atoms/ActionMenu/index.ts";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";

export interface ParticipantRowProps {
  /** As shown: "Mei Lin (External)", "Aisha Khan (you)". */
  name: string;
  photoUrl?: string | null | undefined;
  /** Already translated: "Organizer", "Presenter", "Attendee". */
  roleLabel: string;
  speaking?: boolean;
  /** "Bilal Ahmed, speaking": required while speaking. */
  speakingLabel?: string;
  /** Set while the hand is up: "Hand raised". */
  handLabel?: string | undefined;
  micOn: boolean;
  /** "Microphone on" or "Muted". */
  micLabel: string;
  cameraOn: boolean;
  /** "Camera on" or "Camera off". */
  cameraLabel: string;
  actions?: MenuAction[];
  /** The menu button's name: "Actions for Mei Lin (External)". */
  actionsLabel?: string;
}

export function ParticipantRow(props: ParticipantRowProps) {
  const { name, photoUrl, roleLabel, speaking = false, speakingLabel, handLabel } = props;
  const { micOn, micLabel, cameraOn, cameraLabel, actions = [], actionsLabel = name } = props;
  const photo = photoUrl ? { src: photoUrl } : {};
  return (
    <li className="flex min-h-11 items-center gap-2.5 rounded-md px-1 hover:bg-surface-sunken">
      {speaking ? (
        <Avatar name={name} size="sm" speaking speakingLabel={speakingLabel ?? name} {...photo} />
      ) : (
        <Avatar name={name} size="sm" {...photo} />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-[550] text-ink">{name}</span>
        <span className="text-[12px] text-ink-muted">{roleLabel}</span>
      </span>
      {handLabel ? <Icon name="hand" size={18} label={handLabel} className="text-ink" /> : null}
      <Icon name={micOn ? "mic" : "mic-off"} size={18} label={micLabel} className="text-ink-muted" />
      <Icon name={cameraOn ? "camera" : "camera-off"} size={18} label={cameraLabel} className="text-ink-muted" />
      {actions.length > 0 ? <ActionMenu actions={actions} label={actionsLabel} /> : null}
    </li>
  );
}
