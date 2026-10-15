// "Meeting options" for the organizer and co-organizers (approved canvas, AC-F02-02, 34, 36): who skips
// the lobby, who presents, co-organizers (only the organizer changes them; people from the workspace),
// and the attendees' mic and camera. The choices are kept here until Save sends them in one change.
// Locking belongs to a running call, so it is added by the meeting screen (T15), not here.
import { MeetingOptionsForm, type CoOrganizers } from "@meetapp/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../auth/index.ts";
import { useMembers } from "../workspaces/index.ts";
import { meetingErrorText } from "./meeting-errors.ts";
import { useMeeting, useUpdateMeeting, type MeetingDetails } from "./meetings-api.ts";

type Options = MeetingDetails["options"];
const AUDIENCES = ["everyone", "workspace", "organizers"] as const;
const MAX_CO_ORGANIZERS = 10;
const SUGGESTIONS = 5;

export interface MeetingOptionsDialogProps {
  meetingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The organizer adds and removes co-organizers among the workspace's members (not themselves). */
function useCoOrganizers(meeting: MeetingDetails, draft: Options, change: (next: Partial<Options>) => void) {
  const { t } = useTranslation();
  const { data: user } = useSession();
  const members = useMembers(meeting.workspaceId).data?.members ?? [];
  const [query, setQuery] = useState("");
  const nameOf = (id: string) => members.find((m) => m.userId === id)?.name ?? t("meetings.options.someone");
  const isOrganizer = user?.id === meeting.organizer.id;
  const chosen = new Set(draft.coOrganizerIds);
  const found = query.trim().toLowerCase();
  const suggestions = members
    .filter((m) => m.userId !== meeting.organizer.id && !chosen.has(m.userId))
    .filter((m) => found !== "" && m.name.toLowerCase().includes(found))
    .slice(0, SUGGESTIONS);
  const remove = (id: string) => change({ coOrganizerIds: draft.coOrganizerIds.filter((other) => other !== id) });
  const add = (id: string) => {
    change({ coOrganizerIds: [...draft.coOrganizerIds, id].slice(0, MAX_CO_ORGANIZERS) });
    setQuery("");
  };
  const coOrganizers: CoOrganizers = {
    label: t("meetings.options.coOrganizers"),
    people: draft.coOrganizerIds.map((id) => ({
      id,
      name: nameOf(id),
      removeLabel: t("meetings.options.removeCo", { name: nameOf(id) }),
    })),
    hint: isOrganizer ? t("meetings.options.coHint") : t("meetings.options.coHintOthers"),
    ...(isOrganizer
      ? {
          onRemove: remove,
          add: {
            label: t("meetings.options.addCo"),
            query,
            onQuery: setQuery,
            suggestions: suggestions.map((m) => ({
              id: m.userId,
              name: m.name,
              addLabel: t("meetings.options.addCoNamed", { name: m.name }),
            })),
            onAdd: add,
          },
        }
      : {}),
  };
  return { coOrganizers, isOrganizer };
}

/** Save sends the choices in one change; a co-organizer may not send the co-organizer list. */
function useSave(meetingId: string, draft: Options, isOrganizer: boolean, onDone: () => void) {
  const { t } = useTranslation();
  const update = useUpdateMeeting(meetingId);
  const text = update.error ? meetingErrorText(update.error.code, update.error.retryAfterSeconds) : undefined;
  const { coOrganizerIds, ...shared } = draft;
  const save = () => update.mutate(isOrganizer ? { ...shared, coOrganizerIds } : shared, { onSuccess: onDone });
  return { save, saving: update.isPending, error: text ? t(text.key, text.values ?? {}) : undefined };
}

function OptionsForm({ meeting, onOpenChange }: { meeting: MeetingDetails; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Options>(meeting.options);
  const change = (next: Partial<Options>) => setDraft((old) => ({ ...old, ...next }));
  const { coOrganizers, isOrganizer } = useCoOrganizers(meeting, draft, change);
  const { save, saving, error } = useSave(meeting.id, draft, isOrganizer, () => onOpenChange(false));
  const audiences = AUDIENCES.map((value) => ({ value, label: t(`meetings.options.audience.${value}`) }));
  const toSwitch = (key: "allowAttendeeMic" | "allowAttendeeCamera", name: "allowMic" | "allowCamera") => ({
    label: t(`meetings.options.${name}`),
    description: t(`meetings.options.${name}Hint`),
    checked: draft[key],
    onChange: (on: boolean) => change({ [key]: on }),
  });
  return (
    <MeetingOptionsForm
      open
      onOpenChange={onOpenChange}
      title={t("meetings.options.title")}
      meetingTitle={meeting.title}
      closeLabel={t("meetings.options.close")}
      lobbyBypass={{
        label: t("meetings.options.lobby"),
        hint: t("meetings.options.lobbyHint"),
        value: draft.lobbyBypass,
        options: audiences,
        onChange: (v) => change({ lobbyBypass: v as Options["lobbyBypass"] }),
      }}
      whoCanPresent={{
        label: t("meetings.options.present"),
        hint: t("meetings.options.presentHint"),
        value: draft.whoCanPresent,
        options: audiences,
        onChange: (v) => change({ whoCanPresent: v as Options["whoCanPresent"] }),
      }}
      coOrganizers={coOrganizers}
      allowMic={toSwitch("allowAttendeeMic", "allowMic")}
      allowCamera={toSwitch("allowAttendeeCamera", "allowCamera")}
      guestsNote={t("meetings.options.guestsNote")}
      error={error}
      cancelLabel={t("meetings.options.cancel")}
      save={{
        label: t("meetings.options.save"),
        savingLabel: t("meetings.options.saving"),
        onClick: save,
        saving,
      }}
    />
  );
}

export function MeetingOptionsDialog({ meetingId, open, onOpenChange }: MeetingOptionsDialogProps) {
  const meeting = useMeeting(open ? meetingId : undefined);
  if (!open || !meeting.data) return null;
  // A new form each time it opens, starting from the saved options.
  return <OptionsForm key={meeting.dataUpdatedAt} meeting={meeting.data} onOpenChange={onOpenChange} />;
}
