// LobbyRow (molecule): one person waiting in the lobby, as in the approved "Meeting: speaker view"
// screen: photo or initials, the name as shown ("Leo Martins (Guest)"), and Deny and Admit. The buttons'
// spoken names include the person ("Admit Leo Martins (Guest)"), since several rows show the same words.
// It renders a list item; the participant panel supplies the list. All words arrive as props.
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Button } from "../../atoms/Button/index.ts";

export interface LobbyRowProps {
  /** As shown: "Leo Martins (Guest)". */
  name: string;
  photoUrl?: string | null | undefined;
  /** Visible button words: "Admit", "Deny". */
  admitText: string;
  denyText: string;
  /** Spoken names: "Admit Leo Martins (Guest)", "Deny Leo Martins (Guest)". */
  admitLabel: string;
  denyLabel: string;
  onAdmit: () => void;
  onDeny: () => void;
  /** While a decision is being sent, both buttons wait. */
  busy?: boolean;
}

export function LobbyRow(props: LobbyRowProps) {
  const { name, photoUrl, admitText, denyText, admitLabel, denyLabel, onAdmit, onDeny, busy = false } = props;
  return (
    <li className="flex min-h-11 items-center gap-2.5">
      <Avatar name={name} size="sm" {...(photoUrl ? { src: photoUrl } : {})} />
      <span className="min-w-0 flex-1 truncate text-[14px] font-[550] text-ink">{name}</span>
      <Button variant="ghost" size="sm" aria-label={denyLabel} disabled={busy} onClick={onDeny}>
        {denyText}
      </Button>
      <Button size="sm" aria-label={admitLabel} disabled={busy} onClick={onAdmit}>
        {admitText}
      </Button>
    </li>
  );
}
