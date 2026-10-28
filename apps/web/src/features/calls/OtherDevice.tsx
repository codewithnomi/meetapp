// "You're in a call on another device" (F15 AC-F15-33, design 3.8): a window that isn't in the call sees
// the person's running chat call, with Join on this device (a second participant) and Transfer to this
// device (this one connects first, then the other seat is taken out). Checked every 10 seconds while
// this window isn't in a call. It sits above the screen and pushes it down, so it never covers a button.
import { OtherDeviceBar } from "@meetapp/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ApiError } from "../api/index.ts";
import { useVisit, type Joined } from "../meetings/index.ts";
import { CALL_KEYS } from "./call-keys.ts";
import { activeCalls, joinCall, transferCall } from "./calls-api.ts";
import type { ActiveCalls } from "./call-types.ts";
import { useChatCall } from "./chat-call.ts";
import { useEnterCall } from "./enter-call.ts";

type Active = ActiveCalls["calls"][number];
type Move = { call: Active; transfer: boolean };

/** Join adds this device; Transfer replaces the device that has been in the call longest. */
function move({ call, transfer }: Move): Promise<Joined> {
  const from = call.seats[0]?.attendanceId;
  return transfer && from ? transferCall(call.callId, from) : joinCall(call.callId);
}

export function OtherDevice({ onEntered }: { onEntered: () => void }) {
  const { t } = useTranslation();
  const inCall = useVisit((state) => state.visit !== undefined);
  const left = useChatCall((state) => state.left);
  const active = useQuery({
    queryKey: CALL_KEYS.active,
    queryFn: activeCalls,
    refetchInterval: 10_000,
    enabled: !inCall,
  });
  const enter = useEnterCall(onEntered);
  const moving = useMutation<Joined, ApiError, Move>({
    mutationFn: move,
    onSuccess: (joined, { call }) =>
      enter(joined, {
        callId: call.callId,
        conversationId: call.conversationId ?? "",
        media: call.media,
        title: call.title,
        oneToOne: call.oneToOne,
        phase: "in_call",
      }),
  });
  // An answer that isn't the expected list (an older backend, a test double) simply shows no bar.
  const calls = Array.isArray(active.data?.calls) ? active.data.calls : [];
  const call = calls.find((c) => c.seats.length > 0 && c.conversationId !== null && c.callId !== left);
  if (inCall || !call) return null;
  const last = moving.variables;
  return (
    <div className="flex justify-center px-4 pt-3">
      <OtherDeviceBar
        label={t("calls.otherDevice.label")}
        title={t("calls.otherDevice.title")}
        callTitle={call.title}
        join={{ label: t("calls.otherDevice.join"), onClick: () => moving.mutate({ call, transfer: false }) }}
        transfer={{ label: t("calls.otherDevice.transfer"), onClick: () => moving.mutate({ call, transfer: true }) }}
        pendingText={moving.isPending ? t("calls.otherDevice.moving") : undefined}
        error={
          moving.isError && last
            ? {
                text: t("calls.failed.join"),
                retry: { label: t("calls.failed.retry"), onClick: () => moving.mutate(last) },
              }
            : undefined
        }
      />
    </div>
  );
}
