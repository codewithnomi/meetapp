// Settings → Privacy (F14 AC-F14-13, 24): Read receipts on or off (as in Teams: off means others don't see
// that you've read their messages, and you don't see theirs), and Blocked people with Unblock.
import { Avatar, Button, Toggle } from "@meetapp/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiRequest } from "../../features/api/index.ts";
import { blockedPeople, setReadReceipts, unblockPerson } from "../../features/chats/index.ts";
import { SettingsShell, type SettingsScreen } from "../../features/profile/index.ts";

export interface PrivacyPageProps {
  onNavigate: (screen: SettingsScreen) => void;
  onBack: () => void;
}

const PREFS = ["chat-prefs"];
const BLOCKED = ["chat-blocked"];

function ReadReceipts() {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const prefs = useQuery({
    queryKey: PREFS,
    queryFn: () => apiRequest<{ readReceipts: boolean }>("/api/v1/me/settings"),
  });
  const change = useMutation({
    mutationFn: setReadReceipts,
    onSettled: () => void queries.invalidateQueries({ queryKey: PREFS }),
  });
  return (
    <Toggle
      id="read-receipts"
      className="max-w-130"
      label={t("settings.privacy.readReceipts")}
      description={t("settings.privacy.readReceiptsHint")}
      checked={change.isPending ? (change.variables ?? true) : (prefs.data?.readReceipts ?? true)}
      disabled={prefs.isPending || change.isPending}
      onChange={(next) => change.mutate(next)}
    />
  );
}

function Blocked() {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const people = useQuery({ queryKey: BLOCKED, queryFn: blockedPeople }).data?.people ?? [];
  const unblock = (userId: string) =>
    void unblockPerson(userId).then(() => queries.invalidateQueries({ queryKey: BLOCKED }));
  return (
    <section aria-labelledby="blocked-title" className="flex flex-col gap-3">
      <h2 id="blocked-title" className="m-0 text-heading text-ink">
        {t("settings.privacy.blockedTitle")}
      </h2>
      {people.length === 0 ? <p className="m-0 text-ink-muted">{t("settings.privacy.blockedNone")}</p> : null}
      <ul aria-labelledby="blocked-title" className="m-0 flex list-none flex-col gap-1 p-0">
        {people.map((person) => (
          <li key={person.userId} className="flex items-center gap-3 rounded-md bg-surface px-3 py-2">
            <Avatar name={person.name} size="md" {...(person.photoUrl ? { src: person.photoUrl } : {})} />
            <span className="flex-1 font-semibold text-ink">{person.name}</span>
            <Button variant="secondary" size="sm" onClick={() => unblock(person.userId)}>
              {t("settings.privacy.unblock", { name: person.name })}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PrivacyPage({ onNavigate, onBack }: PrivacyPageProps) {
  return (
    <SettingsShell screen="privacy" onNavigate={onNavigate} onBack={onBack}>
      <ReadReceipts />
      <Blocked />
    </SettingsShell>
  );
}
