// ProfilePage (page): "Profile and account" from the approved canvas (AC-F01-10, 12, 25): photo and
// name, email and sign-in, Sign out and Sign out everywhere, and where to ask about one's data.
import { Button, Spinner } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { ActionErrorNotice, useSignOut, useSignOutEverywhere } from "../../features/auth/index.ts";
import { SettingsShell, type SettingsScreen } from "../../features/profile/index.ts";
import { useMe } from "../../features/workspaces/index.ts";
import { AccountSection } from "./AccountSection.tsx";
import { ProfileSection } from "./ProfileSection.tsx";

export interface ProfilePageProps {
  onNavigate: (screen: SettingsScreen) => void;
  onBack: () => void;
}

/** Sign out (this computer) or Sign out everywhere (every device), as in AC-F01-12. */
function SignOutSection() {
  const { t } = useTranslation();
  const signOut = useSignOut();
  const everywhere = useSignOutEverywhere();
  const busy = signOut.isPending || everywhere.isPending;
  return (
    <section aria-labelledby="sign-out-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="sign-out-title" className="m-0 text-heading text-ink">
          {t("profile.signOut.title")}
        </h2>
        <p className="m-0 max-w-[64ch] text-ink-muted">{t("profile.signOut.description")}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={busy} onClick={() => signOut.mutate()}>
          {t("settings.account.signOut")}
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => everywhere.mutate()}>
          {t("settings.account.signOutEverywhere")}
        </Button>
      </div>
    </section>
  );
}

function DataSection({ supportEmail }: { supportEmail: string }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="data-title" className="flex flex-col gap-2 rounded-lg bg-surface-sunken px-5 py-4">
      <h2 id="data-title" className="m-0 text-[15px] leading-5.5 font-[650]">
        {t("profile.data.title")}
      </h2>
      <p className="m-0 text-[14px] leading-5 text-ink-muted">{t("profile.data.text", { email: supportEmail })}</p>
    </section>
  );
}

export function ProfilePage({ onNavigate, onBack }: ProfilePageProps) {
  const { t } = useTranslation();
  const me = useMe();
  const data = me.data;
  return (
    <SettingsShell screen="profile" onNavigate={onNavigate} onBack={onBack}>
      {me.isPending ? <Spinner label={t("profile.loading")} /> : null}
      <ActionErrorNotice error={me.error} onRetry={() => void me.refetch()} />
      {data ? (
        <>
          <ProfileSection key={data.user.id} person={data.user} />
          <AccountSection email={data.user.email} signInMethods={data.user.signInMethods} />
        </>
      ) : null}
      <SignOutSection />
      {data ? <DataSection supportEmail={data.supportEmail} /> : null}
    </SettingsShell>
  );
}
