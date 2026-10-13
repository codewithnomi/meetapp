// "Change password" (AC-F01-10): with the current password, or with a code emailed to them (the only way
// when the account has no password yet, e.g. Google only). Every other device is signed out; this one
// stays signed in. The desktop's main process does the call, so the token never reaches the screen.
import { Button, Dialog, Input } from "@meetapp/ui";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ActionErrorNotice, authBridge, useAuthAction } from "../../features/auth/index.ts";

export interface ChangePasswordDialogProps {
  open: boolean;
  email: string;
  hasPassword: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const SECRET_FIELD = "password-secret";

type Change = { newPassword: string } & ({ currentPassword: string } | { code: string });

function SendCode({ email, onSent }: { email: string; onSent: () => void }) {
  const { t } = useTranslation();
  const send = useAuthAction((address: string) => authBridge().requestCode(address, "reset"));
  return (
    <div className="flex flex-col gap-3">
      <ActionErrorNotice error={send.error} onRetry={() => send.mutate(email)} />
      <Button
        variant="secondary"
        className="self-start"
        disabled={send.isPending}
        onClick={() => send.mutate(email, { onSuccess: onSent })}
      >
        {t("profile.password.sendCode")}
      </Button>
    </div>
  );
}

function PasswordForm({ email, useCode, onChanged }: { email: string; useCode: boolean; onChanged: () => void }) {
  const { t } = useTranslation();
  const change = useAuthAction((input: Change) => authBridge().changePassword(input));
  const [secret, setSecret] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [missing, setMissing] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setMissing(!secret || !newPassword);
    if (!secret || !newPassword) return;
    const input: Change = useCode ? { newPassword, code: secret.trim() } : { newPassword, currentPassword: secret };
    change.mutate(input, { onSuccess: onChanged });
  };
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {useCode ? <p className="m-0 text-ink-muted">{t("profile.password.codeSent", { email })}</p> : null}
      <Input
        id={SECRET_FIELD}
        type={useCode ? "text" : "password"}
        inputMode={useCode ? "numeric" : undefined}
        autoComplete={useCode ? "one-time-code" : "current-password"}
        label={useCode ? t("profile.password.code") : t("profile.password.current")}
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        {...(missing && !secret ? { error: t("profile.password.required") } : {})}
      />
      <Input
        id="password-new"
        type="password"
        autoComplete="new-password"
        label={t("profile.password.new")}
        hint={t("profile.password.newHint")}
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        {...(missing && !newPassword ? { error: t("profile.password.required") } : {})}
      />
      <ActionErrorNotice error={change.error} onRetry={() => change.reset()} />
      {change.isPending ? (
        <Button type="submit" className="self-end" loading loadingLabel={t("profile.password.saving")}>
          {t("profile.password.save")}
        </Button>
      ) : (
        <Button type="submit" className="self-end">
          {t("profile.password.save")}
        </Button>
      )}
    </form>
  );
}

export function ChangePasswordDialog({ open, email, hasPassword, onClose, onChanged }: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"current" | "send" | "code">(hasPassword ? "current" : "send");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      title={hasPassword ? t("profile.password.title") : t("profile.account.setPassword")}
      description={t("profile.password.description")}
      closeLabel={t("profile.password.close")}
      {...(mode === "send" ? {} : { initialFocusId: SECRET_FIELD })}
    >
      {mode === "send" ? <SendCode email={email} onSent={() => setMode("code")} /> : null}
      {mode === "send" ? null : (
        <PasswordForm key={mode} email={email} useCode={mode === "code"} onChanged={onChanged} />
      )}
      {mode === "current" ? (
        <Button variant="ghost" className="self-start" onClick={() => setMode("send")}>
          {t("profile.password.useCode")}
        </Button>
      ) : null}
    </Dialog>
  );
}
