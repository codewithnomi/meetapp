// "People to invite" (F13 AC-F13-07, 08): members of the workspace by name or email, and any valid email
// address as an outside invitee. Above 100 people a note says a meeting holds 100 at once.
import { SCHEDULE_LIMITS } from "@meetapp/contracts";
import { Notice, PeoplePicker } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { findPeople } from "../../features/chats/index.ts";
import type { FormInvitee } from "../../features/scheduling/index.ts";

const isEmail = (text: string) => z.email().max(254).safeParse(text).success;
const keyOf = (i: FormInvitee) => ("userId" in i ? i.userId : `email:${i.email.toLowerCase()}`);

/** The typed words, the members they match, and an email that can be added as is. */
function useInviteeSearch(workspaceId: string, invitees: FormInvitee[], onChange: (invitees: FormInvitee[]) => void) {
  const [query, setQuery] = useState("");
  const q = query.trim();
  const found = useQuery({
    queryKey: ["schedule-people", workspaceId, q],
    queryFn: () => findPeople(workspaceId, q),
    enabled: q.length > 0,
    staleTime: 10_000,
  }).data;
  const chosen = new Set(invitees.map(keyOf));
  const members = (found?.people ?? []).filter((p) => !p.external && !chosen.has(p.userId));
  const full = invitees.length >= SCHEDULE_LIMITS.invitees;
  const add = (invitee: FormInvitee) => {
    if (!full && !chosen.has(keyOf(invitee))) onChange([...invitees, invitee]);
    setQuery("");
  };
  const email = isEmail(q) && members.length === 0 && !chosen.has(`email:${q.toLowerCase()}`) ? q : undefined;
  return { query, setQuery, members, add, email };
}

function chipOf(i: FormInvitee, t: TFunction) {
  const name = "userId" in i ? i.name : i.email;
  return { id: keyOf(i), name, removeLabel: t("schedule.remove", { name }) };
}

export function InviteesField({
  workspaceId,
  invitees,
  error,
  onChange,
}: {
  workspaceId: string;
  invitees: FormInvitee[];
  error?: string | undefined;
  onChange: (invitees: FormInvitee[]) => void;
}) {
  const { t } = useTranslation();
  const { query, setQuery, members, add, email } = useInviteeSearch(workspaceId, invitees, onChange);
  return (
    <div className="flex flex-col gap-2">
      <PeoplePicker
        inputId="schedule-people"
        label={t("schedule.people")}
        hint={error ?? t("schedule.peopleHint")}
        picked={invitees.map((i) => chipOf(i, t))}
        query={query}
        onQueryChange={setQuery}
        suggestions={members.map((p) => ({ id: p.userId, name: p.name, photoUrl: p.photoUrl }))}
        suggestionsLabel={t("schedule.suggestions")}
        onPick={(id) => {
          const person = members.find((p) => p.userId === id);
          if (person) add({ userId: person.userId, name: person.name });
        }}
        onRemove={(id) => onChange(invitees.filter((i) => keyOf(i) !== id))}
        noAccount={
          email
            ? {
                email,
                message: t("schedule.addEmailText", { email }),
                inviteLabel: t("schedule.addEmail", { email }),
                onInvite: () => add({ email }),
              }
            : undefined
        }
      />
      {invitees.length > SCHEDULE_LIMITS.callSize ? (
        <Notice tone="neutral" icon="users">
          {t("schedule.overCallSize")}
        </Notice>
      ) : null}
    </div>
  );
}
