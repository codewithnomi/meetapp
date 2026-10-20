// How people are named in the meeting (design 3.5): the display name with "(you)", "(External)" or
// "(Guest)" added by the app, and the meeting role in words.
import type { TFunction } from "i18next";
import type { CallPerson } from "../../features/meetings/index.ts";

export function shownName(t: TFunction, person: CallPerson): string {
  if (person.isYou) return t("meetings.call.you", { name: person.name });
  if (person.group === "external") return t("meetings.call.external", { name: person.name });
  if (person.group === "guest") return t("meetings.call.guest", { name: person.name });
  return person.name;
}

export const roleName = (t: TFunction, person: CallPerson) => t(`meetings.call.roles.${person.role}`);
