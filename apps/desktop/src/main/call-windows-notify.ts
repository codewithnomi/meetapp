// F16's missed-call notification (design.md 3.7; AC-F16-10–13, 23; D080), without Electron so it can be
// tested: the main window's translated words, names only, one Call back button; a click opens the chat.
// A notification the Mac refuses (unsigned app, notifications off) is quietly ignored.
import type { CallWindowsMissed, CallWindowsNotificationAction } from "@meetapp/contracts";

interface NotificationLike {
  on(event: "click" | "action" | "failed" | "close", listener: () => void): unknown;
  show(): void;
}
export interface NotificationKind {
  isSupported(): boolean;
  new (options: { title: string; body: string; actions: { type: "button"; text: string }[] }): NotificationLike;
}

/** Shown notifications are kept until used, or their Call back click could be lost (bug review). */
const shown = new Set<NotificationLike>();
/** Never touched ones are let go after this many newer ones (security review). */
const KEPT_NOTIFICATIONS = 50;

export function notifyMissed(
  missed: CallWindowsMissed,
  Kind: NotificationKind,
  onAction: (action: CallWindowsNotificationAction) => void,
): void {
  if (!Kind.isSupported()) return;
  const { title, body, callBack } = missed.text;
  const notification = new Kind({ title, body, actions: [{ type: "button", text: callBack }] });
  shown.add(notification);
  if (shown.size > KEPT_NOTIFICATIONS) shown.delete(shown.values().next().value as NotificationLike);
  const done = () => shown.delete(notification);
  notification.on("click", () => {
    done();
    onAction({ name: "openChat", conversationId: missed.conversationId });
  });
  notification.on("action", () => {
    done();
    onAction({ name: "callBack", conversationId: missed.conversationId, video: missed.kind === "video" });
  });
  // Refused by the Mac (unsigned app, notifications off, D080): nothing else happens.
  notification.on("failed", done);
  notification.on("close", done);
  notification.show();
}
