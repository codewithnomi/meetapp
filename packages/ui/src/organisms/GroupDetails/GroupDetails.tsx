// GroupDetails (organism): a group chat's details on the approved canvas (F14Group, AC-F14-14–18): its
// name (any member renames it: saved on Enter or when the field is left), the people with their status and
// "(External)", Add people, a remove button for each other person, and Leave group.
import { useId, useState } from "react";
import { Avatar } from "../../atoms/Avatar/index.ts";
import { Button } from "../../atoms/Button/index.ts";
import { IconButton } from "../../atoms/IconButton/index.ts";
import { Input } from "../../atoms/Input/index.ts";
import { StatusDot, type ChatStatus } from "../../atoms/StatusDot/index.ts";

export interface GroupPerson {
  id: string;
  /** With "(you)" for the viewer, already translated. */
  name: string;
  photoUrl?: string | null | undefined;
  status?: { value: ChatStatus; label: string } | null | undefined;
  externalLabel?: string | undefined;
  /** "Remove Sara Malik from the group"; absent for the viewer. */
  removeLabel?: string | undefined;
}

export interface GroupDetailsProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  nameLabel: string;
  name: string;
  /** Called with the new name (1–80 characters, checked by the page). */
  onRename: (name: string) => void;
  nameError?: string | undefined;
  /** "People (6)". */
  peopleHeading: string;
  addLabel: string;
  onAdd: () => void;
  people: GroupPerson[];
  onRemove: (id: string) => void;
  leaveLabel: string;
  onLeave: () => void;
}

function Person({ person, onRemove }: { person: GroupPerson; onRemove: () => void }) {
  return (
    <li className="flex min-h-13 items-center gap-3 px-1.5 py-1">
      <span className="relative flex-none">
        <Avatar name={person.name} size="md" {...(person.photoUrl ? { src: person.photoUrl } : {})} />
        {person.status ? <StatusDot status={person.status.value} label={person.status.label} placed /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">
          {person.name}{" "}
          {person.externalLabel ? <span className="text-[12px] text-ink-muted">{person.externalLabel}</span> : null}
        </span>
        {person.status ? <span className="text-[12px] text-ink-muted">{person.status.label}</span> : null}
      </span>
      {person.removeLabel ? (
        <IconButton icon="close" label={person.removeLabel} variant="ghost" size="sm" onClick={onRemove} />
      ) : null}
    </li>
  );
}

function NameField(props: {
  label: string;
  name: string;
  error: string | undefined;
  onRename: (name: string) => void;
}) {
  const id = useId();
  const [name, setName] = useState(props.name);
  const save = () => {
    if (name.trim() !== props.name) props.onRename(name.trim());
  };
  return (
    <Input
      id={id}
      label={props.label}
      value={name}
      maxLength={80}
      {...(props.error ? { error: props.error } : {})}
      onChange={(event) => {
        setName(event.target.value);
      }}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") save();
      }}
    />
  );
}

export function GroupDetails(props: GroupDetailsProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="box-border flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-6 text-ink"
    >
      <div className="flex items-center gap-2">
        <h2 id={headingId} className="m-0 flex-1 text-[22px] leading-7 font-bold">
          {props.title}
        </h2>
        <IconButton icon="close" label={props.closeLabel} variant="ghost" size="sm" onClick={props.onClose} />
      </div>
      {/* A new name from elsewhere (news) starts the field again. */}
      <NameField
        key={props.name}
        label={props.nameLabel}
        name={props.name}
        error={props.nameError}
        onRename={props.onRename}
      />
      <div className="flex items-center gap-2">
        <h3 className="m-0 flex-1 text-[15px]">{props.peopleHeading}</h3>
        <Button variant="secondary" size="sm" onClick={props.onAdd}>
          {props.addLabel}
        </Button>
      </div>
      <ul aria-label={props.peopleHeading} className="m-0 flex list-none flex-col gap-0.5 p-0">
        {props.people.map((person) => (
          <Person
            key={person.id}
            person={person}
            onRemove={() => {
              props.onRemove(person.id);
            }}
          />
        ))}
      </ul>
      <Button variant="ghost" className="self-start text-danger" onClick={props.onLeave}>
        {props.leaveLabel}
      </Button>
    </section>
  );
}
