// While a chat pane's data loads: a spinner; when it failed: the reason with Retry (UI rules: every
// screen has loading and error states). Renders nothing once the data is there: a later reload that fails
// keeps what is on screen.
import { Notice, Spinner } from "@meetapp/ui";
import { useTranslation } from "react-i18next";

export interface LoadStateProps {
  query: { data: unknown; isPending: boolean; isError: boolean; refetch: () => unknown };
  /** "Loading chats…" and the like. */
  loadingLabel: string;
}

export function LoadState({ query, loadingLabel }: LoadStateProps) {
  const { t } = useTranslation();
  if (query.data !== undefined) return null;
  if (query.isError)
    return (
      <Notice tone="danger" action={{ label: t("chats.load.retry"), onClick: () => void query.refetch() }}>
        {t("chats.load.failed")}
      </Notice>
    );
  if (query.isPending) return <Spinner label={loadingLabel} />;
  return null;
}

/** Whether a LoadState shows something (so the pane leaves out its normal content). */
export const showsLoadState = (query: LoadStateProps["query"]) =>
  query.data === undefined && (query.isError || query.isPending);
