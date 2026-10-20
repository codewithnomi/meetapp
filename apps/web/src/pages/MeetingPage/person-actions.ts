// What the viewer may do to one person (approved "Meeting: speaker view" menu, AC-F02-23, 33, 35, 36):
// mute, lower the hand, make a presenter or an attendee, pin for me (everyone), remove. Only what the
// viewer's role allows is listed; the backend checks again.
import type { MenuAction } from "@meetapp/ui";
import type { TFunction } from "i18next";
import { actOn, canActOn, setRole, type CallPerson, type Joined } from "../../features/meetings/index.ts";

export interface ActionContext {
  t: TFunction;
  visit: Joined;
  me: CallPerson | undefined;
  pinnedId: string | undefined;
  onPin: (personId: string | undefined) => void;
  /** Shows a short note when the backend refused (e.g. the person already left). */
  onFailed: () => void;
}

export function personActions(
  person: CallPerson,
  { t, visit, me, pinnedId, onPin, onFailed }: ActionContext,
): MenuAction[] {
  const run = (work: Promise<unknown>) => void work.catch(onFailed);
  const role = me?.role;
  const actions: MenuAction[] = [];
  const other = !person.isYou;
  if (other && person.micOn && canActOn(role, "mute", person.role))
    actions.push({
      id: "mute",
      label: t("meetings.call.actions.mute"),
      onSelect: () => run(actOn(visit, person.id, "mute")),
    });
  if (other && person.handRaisedAt && canActOn(role, "mute", person.role))
    actions.push({
      id: "lower",
      label: t("meetings.call.actions.lowerHand"),
      onSelect: () => run(actOn(visit, person.id, "lower-hand")),
    });
  if (other && canActOn(role, "setRole", person.role) && (person.role === "presenter" || person.role === "attendee")) {
    const next = person.role === "presenter" ? "attendee" : "presenter";
    actions.push({
      id: "role",
      label: t(`meetings.call.actions.make.${next}`),
      onSelect: () => run(setRole(visit, person.id, next)),
    });
  }
  actions.push(
    pinnedId === person.id
      ? { id: "unpin", label: t("meetings.call.unpin"), onSelect: () => onPin(undefined) }
      : { id: "pin", label: t("meetings.call.actions.pin"), onSelect: () => onPin(person.id) },
  );
  if (other && canActOn(role, "remove", person.role))
    actions.push({
      id: "remove",
      label: t("meetings.call.actions.remove"),
      danger: true,
      onSelect: () => run(actOn(visit, person.id, "remove")),
    });
  return actions;
}
