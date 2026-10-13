// Shows why a sign-in step failed, as the approved screens do; a connection problem gets a Retry
// button (AC-F01-29). Renders nothing when there is no error.
import { Notice } from "@meetapp/ui";
import { useTranslation } from "react-i18next";
import { errorText, isNetworkError } from "./auth-errors.ts";

export interface ActionErrorNoticeProps {
  error: { code: string; retryAfterSeconds?: number | undefined } | null;
  onRetry: () => void;
}

export function ActionErrorNotice({ error, onRetry }: ActionErrorNoticeProps) {
  const { t } = useTranslation();
  if (!error) return null;
  const text = errorText(error.code, error.retryAfterSeconds);
  const network = isNetworkError(error.code);
  return (
    <Notice
      tone="danger"
      icon={network ? "signal" : "lock"}
      {...(network && { action: { label: t("auth.errors.retry"), onClick: onRetry } })}
    >
      {t(text.key, text.values ?? {})}
    </Notice>
  );
}
