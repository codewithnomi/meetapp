// "Account and sign-in" (AC-F01-10, 25): the confirmed email, the password (change it, or set one with
// an emailed code when there is none), and which other ways to sign in are linked.
import { Badge, Button, Notice } from "@meetapp/ui";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChangePasswordDialog } from "./ChangePasswordDialog.tsx";

export interface AccountSectionProps {
  email: string;
  signInMethods: ("password" | "google" | "microsoft")[];
}

const ROW = "flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-5 py-4 last:border-b-0";

function Row({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
  return (
    <div className={ROW}>
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        <span className="text-[14px] text-ink-muted">{detail}</span>
      </div>
      {children}
    </div>
  );
}

/** The password row and its window; after a change, the confirmation shows above the list. */
function PasswordRow({
  email,
  hasPassword,
  onChanged,
}: {
  email: string;
  hasPassword: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [changing, setChanging] = useState(false);
  return (
    <Row
      title={t("profile.account.password")}
      detail={hasPassword ? t("profile.account.passwordHint") : t("profile.account.noPassword")}
    >
      <Button variant="secondary" size="sm" onClick={() => setChanging(true)}>
        {hasPassword ? t("profile.account.changePassword") : t("profile.account.setPassword")}
      </Button>
      {changing ? (
        <ChangePasswordDialog
          open
          email={email}
          hasPassword={hasPassword}
          onClose={() => setChanging(false)}
          onChanged={() => {
            setChanging(false);
            onChanged();
          }}
        />
      ) : null}
    </Row>
  );
}

export function AccountSection({ email, signInMethods }: AccountSectionProps) {
  const { t } = useTranslation();
  const [changed, setChanged] = useState(false);
  const providers = signInMethods
    .filter((method) => method !== "password")
    .map((method) => t(`profile.account.providers.${method}`));
  const methods =
    providers.length > 0
      ? t("profile.account.methodsLinked", { list: providers.join(", ") })
      : t("profile.account.methodsNone");
  return (
    <section aria-labelledby="account-title" className="flex flex-col gap-4">
      <h2 id="account-title" className="m-0 text-heading text-ink">
        {t("profile.account.title")}
      </h2>
      {changed ? <Notice tone="success">{t("profile.password.done")}</Notice> : null}
      <div className="rounded-lg border border-line bg-surface">
        <Row title={t("profile.account.email")} detail={email}>
          <Badge tone="success" icon="check">
            {t("profile.account.confirmed")}
          </Badge>
        </Row>
        <PasswordRow
          email={email}
          hasPassword={signInMethods.includes("password")}
          onChanged={() => setChanged(true)}
        />
        <Row title={t("profile.account.methods")} detail={methods}>
          {providers.map((name) => (
            <Badge key={name} tone="success" icon="check">
              {name}
            </Badge>
          ))}
        </Row>
      </div>
    </section>
  );
}
