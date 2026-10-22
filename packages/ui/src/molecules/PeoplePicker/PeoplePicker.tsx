// PeoplePicker (molecule): the "To:" field of New chat and Add people (approved canvas F14NewChat, AC-F14-07,
// 08): chosen people as chips, a text field, and suggestions below it (name, detail, status, "(External)").
// An exact email with no account shows a note with Invite. A combobox: arrows move through the
// suggestions, Enter picks, Backspace in an empty field removes the last chip.
import { useId, useState, type KeyboardEvent } from "react";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Button } from "../../atoms/Button/index.ts";
import { Icon } from "../../atoms/Icon/index.ts";
import { StatusDot, type ChatStatus } from "../../atoms/StatusDot/index.ts";
import { FOCUS_RING, cx } from "../../lib/cx.ts";

export interface PickedPerson {
  id: string;
  name: string;
  photoUrl?: string | null | undefined;
  /** "Remove Sara Malik". */
  removeLabel: string;
}

export interface PersonSuggestion {
  id: string;
  name: string;
  photoUrl?: string | null | undefined;
  /** "Product lead · Available", or "Not in Aria · they'll get a chat request first". */
  detail?: string | undefined;
  status?: { value: ChatStatus; label: string } | null | undefined;
  /** "(External)". */
  externalLabel?: string | undefined;
}

export interface PeoplePickerProps {
  /** "To:". */
  label: string;
  hint?: string | undefined;
  picked: PickedPerson[];
  query: string;
  onQueryChange: (query: string) => void;
  suggestions: PersonSuggestion[];
  /** The suggestion list's name: "Suggestions". */
  suggestionsLabel: string;
  onPick: (id: string) => void;
  onRemove: (id: string) => void;
  /** An exact email nobody uses yet (AC-F14-08). */
  noAccount?: { email: string; message: string; inviteLabel: string; onInvite: () => void } | undefined;
}

function Chip({ person, onRemove }: { person: PickedPerson; onRemove: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-soft pr-1 pl-1.5 text-[13px] font-semibold text-accent-text">
      <Avatar name={person.name} size="sm" {...(person.photoUrl ? { src: person.photoUrl } : {})} />
      {person.name}
      <button
        type="button"
        aria-label={person.removeLabel}
        onClick={onRemove}
        className={cx("grid size-6 place-items-center rounded-full bg-transparent text-inherit", FOCUS_RING)}
      >
        <Icon name="close" size={14} />
      </button>
    </span>
  );
}

function Option({
  person,
  active,
  id,
  onPick,
}: {
  person: PersonSuggestion;
  active: boolean;
  id: string;
  onPick: () => void;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(event) => {
        event.preventDefault();
        onPick();
      }}
      className={cx(
        "flex min-h-14 cursor-pointer items-center gap-3 rounded-md px-3 py-1.5",
        active && "bg-surface-sunken",
      )}
    >
      <span className="relative flex-none">
        <Avatar name={person.name} size="md" {...(person.photoUrl ? { src: person.photoUrl } : {})} />
        {person.status ? <StatusDot status={person.status.value} label={person.status.label} placed /> : null}
      </span>
      <span className="flex flex-1 flex-col">
        <span className="font-semibold">
          {person.name}{" "}
          {person.externalLabel ? <span className="text-[12px] text-ink-muted">{person.externalLabel}</span> : null}
        </span>
        {person.detail ? <span className="text-[12px] text-ink-muted">{person.detail}</span> : null}
      </span>
    </li>
  );
}

function NoAccount(note: NonNullable<PeoplePickerProps["noAccount"]>) {
  return (
    <div className="flex flex-col gap-2.5 rounded-md bg-surface-sunken px-4 py-3.5">
      <span className="font-semibold">{note.email}</span>
      <span className="text-[14px] text-ink-muted">{note.message}</span>
      <Button variant="secondary" size="sm" className="self-start" onClick={note.onInvite}>
        {note.inviteLabel}
      </Button>
    </div>
  );
}

interface FieldProps {
  props: PeoplePickerProps;
  ids: { inputId: string; listId: string; hintId: string };
  open: boolean;
  current: number;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onTyped: () => void;
}

/** "To:", the chips and the text field: the combobox itself. */
function Field({ props, ids, open, current, onKeyDown, onTyped }: FieldProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border-2 border-line-strong bg-surface px-2.5 py-2 focus-within:border-focus-ring">
      <label htmlFor={ids.inputId} className="pr-1 font-semibold text-ink-muted">
        {props.label}
      </label>
      {props.picked.map((person) => (
        <Chip
          key={person.id}
          person={person}
          onRemove={() => {
            props.onRemove(person.id);
          }}
        />
      ))}
      <input
        id={ids.inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={ids.listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${ids.listId}-${String(current)}` : undefined}
        aria-describedby={props.hint ? ids.hintId : undefined}
        value={props.query}
        onChange={(event) => {
          onTyped();
          props.onQueryChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
        className="h-8 min-w-40 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none"
      />
    </div>
  );
}

/** Arrows move through the suggestions, Enter picks, Backspace in an empty field removes the last chip. */
function useComboKeys({ picked, suggestions, query, onPick, onRemove }: PeoplePickerProps) {
  const [active, setActive] = useState(0);
  const open = suggestions.length > 0;
  const current = Math.min(active, suggestions.length - 1);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && open) setActive((current + 1) % suggestions.length);
    else if (event.key === "ArrowUp" && open) setActive((current - 1 + suggestions.length) % suggestions.length);
    else if (event.key === "Enter" && open) onPick(suggestions[current]?.id ?? "");
    else if (event.key === "Backspace" && query === "" && picked.length > 0) onRemove(picked.at(-1)?.id ?? "");
    else return;
    event.preventDefault();
  };
  return { open, current, setActive, onKeyDown };
}

export function PeoplePicker(props: PeoplePickerProps) {
  const { suggestions } = props;
  const inputId = useId();
  const listId = useId();
  const hintId = useId();
  const { open, current, setActive, onKeyDown } = useComboKeys(props);

  return (
    <div className="flex flex-col gap-2 text-ink">
      <Field
        props={props}
        ids={{ inputId, listId, hintId }}
        open={open}
        current={current}
        onKeyDown={onKeyDown}
        onTyped={() => setActive(0)}
      />
      {props.hint ? (
        <p id={hintId} className="m-0 text-[13px] text-ink-muted">
          {props.hint}
        </p>
      ) : null}
      <ul
        id={listId}
        role="listbox"
        aria-label={props.suggestionsLabel}
        hidden={!open}
        className="m-0 flex list-none flex-col gap-0.5 rounded-md border border-line bg-surface-raised p-2 shadow-2"
      >
        {suggestions.map((person, index) => (
          <Option
            key={person.id}
            id={`${listId}-${String(index)}`}
            person={person}
            active={index === current}
            onPick={() => {
              props.onPick(person.id);
            }}
          />
        ))}
      </ul>
      {props.noAccount ? <NoAccount {...props.noAccount} /> : null}
    </div>
  );
}
