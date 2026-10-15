// JoinMeetingPage (page): "Join a meeting" for people without an account (AC-F02-08), opened from the
// sign-in screen: the same form as on the Meetings page, then the pre-join as a guest.
import { AuthLayout, AuthTiles, Button } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { AuthHeading } from "../../features/auth/index.ts";
import { JoinMeetingForm, type PreJoinState } from "../../features/meetings/index.ts";

export interface JoinMeetingPageProps {
  onFound: (state: PreJoinState) => void;
  onBack: () => void;
}

export function JoinMeetingPage({ onFound, onBack }: JoinMeetingPageProps) {
  const { t } = useTranslation();
  return (
    <AuthLayout
      brand={t("auth.brand")}
      aside={<AuthTiles headline={t("auth.tiles.headline")} description={t("auth.tiles.description")} />}
    >
      <AuthHeading title={t("meetings.guest.title")}>{t("meetings.guest.subtitle")}</AuthHeading>
      <JoinMeetingForm onFound={onFound} />
      <Button variant="ghost" className="self-start" onClick={onBack}>
        {t("meetings.guest.back")}
      </Button>
    </AuthLayout>
  );
}
