// The chat header's call buttons (F15 AC-F15-01–03, 18; approved canvas): Video call and Audio call start
// the chat's call (or join the one running); while a call runs, Join replaces them; in a read-only chat
// they are off with the reason; while starting they can't be pressed again; a failure says so with Retry.
import type { ConversationHeaderProps } from "@meetapp/ui";
import { Notice } from "@meetapp/ui";
import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { ApiError } from "../../features/api/index.ts";
import {
  runningCall,
  useJoinCall,
  useStartCall,
  type CallMedia,
  type CallNoteActions,
} from "../../features/calls/index.ts";
import type { ChatItem } from "../../features/chats/index.ts";

/** Why calls are off in this chat, or undefined when they may start. */
function offReason(t: TFunction, item: ChatItem): string | undefined {
  if (item.request === "waiting" || item.request === "not_accepted") return t("calls.readOnly.pending");
  if (item.readOnlyReason) return t(`calls.readOnly.${item.readOnlyReason}`);
  return undefined;
}

function failureText(t: TFunction, error: ApiError): string {
  if (error.code === "CALL_FULL") return t("calls.failed.full");
  if (error.code === "CALL_ENDED") return t("calls.failed.ended");
  if (error.code === "CALL_RATE") return t("calls.failed.rate");
  if (error.code === "CALL_DEVICES") return t("calls.failed.devices");
  return t("calls.failed.start");
}

/** The chat's running call; refreshed with every chat change on the live line (the provider reloads "chats"). */
function useRunningCall(conversationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["chats", "call", conversationId],
    queryFn: () => runningCall(conversationId),
    enabled,
  }).data?.call;
}

/** "Couldn't start the call" with Retry (AC-F15-18). */
function Failure({ text, retry, onRetry }: { text: string; retry: string; onRetry: () => void }) {
  return (
    <div className="px-6 pt-3">
      <Notice tone="danger" action={{ label: retry, onClick: onRetry }}>
        {text}
      </Notice>
    </div>
  );
}

export function useCallButtons(item: ChatItem): {
  calls: ConversationHeaderProps["calls"];
  notice: ReactNode;
  noteActions: CallNoteActions;
} {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const target = { conversationId: item.id, title: item.title, oneToOne: item.kind === "direct" };
  const enter = () => void navigate("/call");
  const start = useStartCall(target, enter);
  const join = useJoinCall(target, enter);
  const [media, setMedia] = useState<CallMedia>("video");
  const reason = offReason(t, item);
  const calling = item.kind !== "meeting" && reason === undefined;
  const running = useRunningCall(item.id, calling);
  const go = (chosen: CallMedia) => {
    setMedia(chosen);
    start.mutate(chosen);
  };
  const error = start.error ?? join.error;
  const calls: ConversationHeaderProps["calls"] = {
    videoLabel: t("calls.buttons.video"),
    audioLabel: t("calls.buttons.audio"),
    onVideo: () => go("video"),
    onAudio: () => go("audio"),
    disabled: !calling,
    disabledReason: reason,
    pending: start.isPending || join.isPending,
    join: running
      ? { label: t("calls.buttons.join"), onJoin: () => join.mutate({ callId: running.callId, media: running.media }) }
      : undefined,
  };
  const retry = () =>
    join.error && running ? join.mutate({ callId: running.callId, media: running.media }) : go(media);
  const notice = error ? (
    <Failure
      text={join.error ? t("calls.failed.join") : failureText(t, error)}
      retry={t("calls.failed.retry")}
      onRetry={retry}
    />
  ) : null;
  // Call notes in the chat: Join the running call, Call back after a missed one (AC-F15-15).
  const noteActions: CallNoteActions = {
    runningCallId: running?.callId,
    join: (callId) => join.mutate({ callId, media: running?.media ?? "video" }),
    callBack: () => go("video"),
  };
  return { calls, notice, noteActions };
}
