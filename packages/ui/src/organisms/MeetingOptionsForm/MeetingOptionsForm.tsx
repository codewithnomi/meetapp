// MeetingOptionsForm (organism): the "Meeting options" dialog of the approved screen, for the organizer
// and co-organizers (AC-F02-02, 34, 36, 37): who can skip the lobby, who can present, the co-organizers
// (only the organizer changes them, up to 10, from the workspace), the attendees' mic and camera, and the
// lock; a note about guests; Cancel and Save. The page holds the values and saves them. All words
// arrive as props.
import { useId } from "react";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Button } from "../../atoms/Button/index.ts";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { Input } from "../../atoms/Input/index.ts";
import { Toggle } from "../../atoms/Toggle/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";
import { DeviceSelect, type DeviceSelectProps } from "../../molecules/DeviceSelect/index.ts";
import { Dialog } from "../../molecules/Dialog/index.ts";
import { Notice } from "../../molecules/Notice/index.ts";

type Choice = Omit<DeviceSelectProps, "children" | "className">;
type Switch = { label: string; description: string; checked: boolean; onChange: (on: boolean) => void };

export interface CoOrganizers {
  label: string;
  people: { id: string; name: string; removeLabel: string }[];
  /** Only the organizer changes the list; others see it read-only. */
  onRemove?: ((id: string) => void) | undefined;
  /** The search for a person to add (organizer only). */
  add?:
    | {
        label: string;
        query: string;
        onQuery: (query: string) => void;
        suggestions: { id: string; name: string; addLabel: string }[];
        onAdd: (id: string) => void;
      }
    | undefined;
  hint: string;
}

export interface MeetingOptionsFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The meeting's title, under the dialog's. */
  meetingTitle: string;
  closeLabel: string;
  lobbyBypass: Choice;
  whoCanPresent: Choice;
  coOrganizers: CoOrganizers;
  allowMic: Switch;
  allowCamera: Switch;
  lock: Switch;
  /** "Guests can join: Aria's owner and admins decide this …". */
  guestsNote: string;
  /** Says what went wrong and how to fix it. */
  error?: string | undefined;
  cancelLabel: string;
  save: { label: string; onClick: () => void; savingLabel: string; saving?: boolean };
}

function AddPerson({ add }: { add: NonNullable<CoOrganizers["add"]> }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Input
        id={id}
        type="search"
        icon="search"
        aria-label={add.label}
        placeholder={add.label}
        value={add.query}
        onChange={(event) => add.onQuery(event.target.value)}
      />
      {add.suggestions.length > 0 ? (
        <ul aria-label={add.label} className="m-0 flex list-none flex-col gap-0.5 rounded-md border border-line p-1.5">
          {add.suggestions.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                aria-label={person.addLabel}
                onClick={() => add.onAdd(person.id)}
                className={cx(
                  "flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-sm px-2 text-left text-[14px] font-[550] hover:bg-surface-sunken",
                  FOCUS_RING,
                )}
              >
                <Avatar name={person.name} size="sm" />
                {person.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CoOrganizerList({ coOrganizers }: { coOrganizers: CoOrganizers }) {
  const headingId = useId();
  const { label, people, onRemove, add, hint } = coOrganizers;
  return (
    <div className="flex flex-col gap-1.5 text-[14px] font-[550]">
      <span id={headingId}>{label}</span>
      {people.length > 0 ? (
        <ul aria-labelledby={headingId} className="m-0 flex list-none flex-wrap gap-2 p-0">
          {people.map((person) => (
            <li
              key={person.id}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-surface-sunken pr-1 pl-1.5"
            >
              <Avatar name={person.name} size="sm" />
              {person.name}
              {onRemove ? (
                <IconButton
                  icon="close"
                  variant="ghost"
                  size="sm"
                  label={person.removeLabel}
                  tooltip={false}
                  onClick={() => onRemove(person.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {add ? <AddPerson add={add} /> : null}
      <span className="text-[12px] leading-4 font-normal text-ink-muted">{hint}</span>
    </div>
  );
}

function Switches({ allowMic, allowCamera, lock }: Pick<MeetingOptionsFormProps, "allowMic" | "allowCamera" | "lock">) {
  return (
    <div className="flex flex-col gap-3.5 border-t border-line pt-1">
      <Toggle id="option-allow-mic" {...allowMic} />
      <Toggle id="option-allow-camera" {...allowCamera} />
      <Toggle id="option-lock" {...lock} />
    </div>
  );
}

export function MeetingOptionsForm(props: MeetingOptionsFormProps) {
  const { open, onOpenChange, title, meetingTitle, closeLabel, lobbyBypass, whoCanPresent, coOrganizers } = props;
  const { guestsNote, error, cancelLabel, save } = props;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={meetingTitle}
      closeLabel={closeLabel}
      size="lg"
    >
      <DeviceSelect {...lobbyBypass} />
      <DeviceSelect {...whoCanPresent} />
      <CoOrganizerList coOrganizers={coOrganizers} />
      <Switches allowMic={props.allowMic} allowCamera={props.allowCamera} lock={props.lock} />
      <p className="m-0 text-[13px] leading-4.5 text-ink-muted">{guestsNote}</p>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="flex flex-wrap justify-end gap-2.5">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        {save.saving ? (
          <Button loading loadingLabel={save.savingLabel}>
            {save.label}
          </Button>
        ) : (
          <Button onClick={save.onClick}>{save.label}</Button>
        )}
      </div>
    </Dialog>
  );
}
