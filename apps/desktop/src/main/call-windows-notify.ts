// F16's missed-call notification (design.md 3.7; AC-F16-10–13, 23; D080), without Electron so it can be
// tested: the main window's translated words, names only, one Call back button; a click opens the chat.
// A notification the Mac refuses (unsigned app, notifications off) is quietly ignored.
import type { CallWindowsMissed, CallWindowsNotificationAction } from "@meetapp/contracts";

interface NotificationLike {
  on(event: "click" | "action" | "failed", listener: () => void): unknown;
  show(): void;
}
export interface NotificationKind {
  isSupported(): boolean;
  new (options: { title: string; body: string; actions: { type: "button"; text: string }[] }): NotificationLike;
}

export function notifyMissed(
  missed: CallWindowsMissed,
  Kind: NotificationKind,
  onAction: (action: CallWindowsNotificationAction) => void,
): void {
  if (!Kind.isSupported()) return;
  const { title, body, callBack } = missed.text;
  const notification = new Kind({ title, body, actions: [{ type: "button", text: callBack }] });
  notification.on("click", () => onAction({ name: "openChat", conversationId: missed.conversationId }));
  notification.on("action", () =>
    onAction({ name: "callBack", conversationId: missed.conversationId, video: missed.kind === "video" }),
  );
  notification.on("failed", () => undefined);
  notification.show();
}
