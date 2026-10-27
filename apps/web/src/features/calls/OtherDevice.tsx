// "You're in a call on another device" (F15 AC-F15-33, design 3.8): a window that isn't in the call sees
// the person's running chat call, with Join on this device (a second participant) and Transfer to this
// device (this one connects first, then the other seat is taken out). Checked every 10 seconds while
// this window isn't in a call.
import { Button } from "@meetapp/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { loadPrefs, savePrefs, useVisit, type Joined } from "../meetings/index.ts";
import { activeCalls, joinCall, transferCall } from "./calls-api.ts";
import type { ActiveCalls } from "./call-types.ts";
import { useChatCall } from "./chat-call.ts";

type Active = ActiveCalls["calls"][number];

function useEnter(onEntered: () => void) {
  const startVisit = useVisit((state) => state.start);
  const begin = useChatCall((state) => state.begin);
  return (joined: Joined, call: Active) => {
    savePrefs({ ...loadPrefs(), cameraOn: call.media === "video", microphoneOn: true });
    startVisit(joined);
    begin({
      callId: call.callId,
      conversationId: call.conversationId ?? "",
      media: call.media,
      title: call.title,
      oneToOne: false,
      phase: "in_call",
    });
    onEntered();
  };
}

export function OtherDevice({ onEntered }: { onEntered: () => void }) {
  const { t } = useTranslation();
  const inCall = useVisit((state) => state.visit !== undefined);
  const active = useQuery({
    queryKey: ["active-calls"],
    queryFn: activeCalls,
    refetchInterval: 10_000,
    enabled: !inCall,
  });
  const enter = useEnter(onEntered);
  const move = useMutation({
    mutationFn: ({ call, transfer }: { call: Active; transfer: boolean }) => {
      const from = call.seats[0]?.attendanceId;
      return transfer && from ? transferCall(call.callId, from) : joinCall(call.callId);
    },
    onSuccess: (joined, { call }) => enter(joined, call),
  });
  const call = active.data?.calls?.find((c) => c.seats.length > 0 && c.conversationId !== null);
  if (inCall || !call) return null;
  return (
    <section
      aria-label={t("calls.otherDevice.label")}
      className="fixed top-4 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl bg-stage px-4 py-3 text-stage-ink shadow-2"
    >
      <span className="flex flex-col">
        <span className="font-semibold">{t("calls.otherDevice.title")}</span>
        <span className="text-[13px] opacity-85">{call.title}</span>
      </span>
      {move.isError ? (
        <span role="alert" className="text-[13px]">
          {t("calls.failed.join")}
        </span>
      ) : null}
      <Button variant="secondary" disabled={move.isPending} onClick={() => move.mutate({ call, transfer: false })}>
        {t("calls.otherDevice.join")}
      </Button>
      <Button disabled={move.isPending} onClick={() => move.mutate({ call, transfer: true })}>
        {t("calls.otherDevice.transfer")}
      </Button>
    </section>
  );
}
