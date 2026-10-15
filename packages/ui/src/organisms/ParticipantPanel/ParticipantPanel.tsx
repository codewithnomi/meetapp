// ParticipantPanel (organism): the Participants panel of the approved "Meeting: speaker view" screen. A
// search field; the lobby on top for those who may let people in (Admit all, and Admit or Deny each);
// then everyone in the meeting, raised hands first in the order they went up (the page sorts), with
// Mute all for those who may. All words arrive as props.
import { useId } from "react";
import { Button } from "../../atoms/Button/index.ts";
import { Input } from "../../atoms/Input/index.ts";
import { LobbyRow, type LobbyRowProps } from "../../molecules/LobbyRow/index.ts";
import { ParticipantRow, type ParticipantRowProps } from "../../molecules/ParticipantRow/index.ts";
import { SidePanel } from "../../molecules/SidePanel/index.ts";

export interface ParticipantPanelProps {
  /** "Participants (23)". */
  title: string;
  closeLabel: string;
  onClose: () => void;
  search: { label: string; value: string; onChange: (value: string) => void };
  /** Only for those who may let people in, and only while someone waits. */
  lobby?:
    | {
        /** "Waiting in the lobby (2)". */
        title: string;
        admitAll: { label: string; onClick: () => void };
        people: (LobbyRowProps & { id: string })[];
      }
    | undefined;
  /** "In the meeting (23)". */
  inMeetingTitle: string;
  /** Only for those who may mute others. */
  muteAll?: { label: string; onClick: () => void } | undefined;
  people: (ParticipantRowProps & { id: string })[];
  /** Shown when the search finds nobody: "Nobody matches “zed”". */
  noMatchText: string;
}

function Lobby({ lobby }: { lobby: NonNullable<ParticipantPanelProps["lobby"]> }) {
  return (
    <section aria-label={lobby.title} className="flex flex-col gap-1.5 rounded-md bg-warning-soft p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-[13px] font-[650]">{lobby.title}</h3>
        <Button variant="secondary" size="sm" onClick={lobby.admitAll.onClick}>
          {lobby.admitAll.label}
        </Button>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {lobby.people.map(({ id, ...row }) => (
          <LobbyRow key={id} {...row} />
        ))}
      </ul>
    </section>
  );
}

export function ParticipantPanel(props: ParticipantPanelProps) {
  const { title, closeLabel, onClose, search, lobby, inMeetingTitle, muteAll, people, noMatchText } = props;
  const searchId = useId();
  return (
    <SidePanel title={title} closeLabel={closeLabel} onClose={onClose}>
      <Input
        id={searchId}
        type="search"
        icon="search"
        aria-label={search.label}
        placeholder={search.label}
        value={search.value}
        onChange={(event) => search.onChange(event.target.value)}
      />
      {lobby && lobby.people.length > 0 ? <Lobby lobby={lobby} /> : null}
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-[13px] font-[650] text-ink-muted">{inMeetingTitle}</h3>
        {muteAll ? (
          <Button variant="ghost" size="sm" icon="mic-off" onClick={muteAll.onClick}>
            {muteAll.label}
          </Button>
        ) : null}
      </div>
      {people.length > 0 ? (
        <ul aria-label={inMeetingTitle} className="m-0 flex list-none flex-col gap-0.5 p-0">
          {people.map(({ id, ...row }) => (
            <ParticipantRow key={id} {...row} />
          ))}
        </ul>
      ) : (
        <p role="status" className="m-0 text-[14px] text-ink-muted">
          {noMatchText}
        </p>
      )}
    </SidePanel>
  );
}
