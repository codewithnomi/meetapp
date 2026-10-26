// Chat requests (approved canvas F14Requests, AC-F14-10, 11, 13): each request with who sent it, their
// email and "(External)", Preview messages, Accept (the chat opens), and Delete with "Also block".
import { ChatRequestCard, Notice } from "@meetapp/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  acceptRequest,
  declineRequest,
  timeLabel,
  useChatRequests,
  type ChatRequest,
} from "../../features/chats/index.ts";
import { LoadState, showsLoadState } from "./LoadState.tsx";

/** The messages a request lets one read before accepting (AC-F14-11). */
function previewOf(request: ChatRequest, locale: string) {
  const now = new Date();
  return request.preview.map((message, index) => ({
    id: String(index),
    senderName: message.senderName,
    text: message.text,
    time: timeLabel(new Date(message.at), now, locale),
  }));
}

function Request({ request, onAccepted }: { request: ChatRequest; onAccepted: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const queries = useQueryClient();
  const [previewing, setPreviewing] = useState(false);
  const [failed, setFailed] = useState(false);
  const refresh = () => queries.invalidateQueries({ queryKey: ["chats"] });
  const name = request.from.name;
  const fail = () => setFailed(true);
  return (
    <div className="flex flex-col gap-2">
      {failed ? <Notice tone="danger">{t("chats.failed")}</Notice> : null}
      <ChatRequestCard
        name={request.kind === "group" ? (request.groupName ?? name) : name}
        photoUrl={request.from.photoUrl}
        externalLabel={t("chats.new.external")}
        intro={
          request.kind === "group"
            ? t("chats.requestsPane.introGroup", { name, group: request.groupName ?? "" })
            : t("chats.requestsPane.intro", { email: request.from.email })
        }
        preview={previewing ? previewOf(request, i18n.language) : undefined}
        previewLabel={t("chats.requestsPane.preview")}
        previewListLabel={t("chats.requestsPane.previewList")}
        onPreview={() => setPreviewing(true)}
        explanation={t("chats.requestsPane.explanation", { name })}
        acceptLabel={t("chats.requestsPane.accept")}
        deleteLabel={t("chats.requestsPane.delete")}
        onAccept={() =>
          void acceptRequest(request.conversationId)
            .then(refresh)
            .then(() => onAccepted(request.conversationId))
            .catch(fail)
        }
        confirm={{
          title: t("chats.requestsPane.deleteTitle"),
          alsoBlockLabel: t("chats.requestsPane.alsoBlock", { name }),
          cancelLabel: t("chats.requestsPane.cancel"),
          deleteLabel: t("chats.requestsPane.delete"),
        }}
        onDelete={(block) => void declineRequest(request.conversationId, block).then(refresh).catch(fail)}
      />
    </div>
  );
}

export function RequestsPane({ onAccepted }: { onAccepted: (id: string) => void }) {
  const { t } = useTranslation();
  const asked = useChatRequests();
  const requests = asked.data?.requests ?? [];
  return (
    <main className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-6 text-ink">
      <header className="flex flex-col gap-1">
        <h2 tabIndex={-1} className="m-0 text-[22px] leading-7 font-bold outline-none">
          {t("chats.requestsPane.title")}
        </h2>
        <p className="m-0 text-[13px] text-ink-muted">{t("chats.requestsPane.hint")}</p>
      </header>
      <LoadState query={asked} loadingLabel={t("chats.load.requests")} />
      {requests.length === 0 && !showsLoadState(asked) ? (
        <p className="m-0 text-ink-muted">{t("chats.requestsPane.none")}</p>
      ) : null}
      {requests.map((request) => (
        <Request key={request.conversationId} request={request} onAccepted={onAccepted} />
      ))}
    </main>
  );
}
