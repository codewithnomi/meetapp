// Which actions the viewer gets on each row of the member list (AC-F01-21, 22, 23), from the actions
// their role allows (`yourActions`, the server's role table). On their own row: Leave (not for the
// owner, who hands over first). Nobody can change or remove the owner. The server checks again.
import type { MembersResponse, WorkspaceAction } from "@meetapp/contracts";

export type ActionKind = "promote" | "demote" | "transfer" | "remove" | "leave";
type Member = MembersResponse["members"][number];

/** Removing, handing over and leaving ask first. */
export const NEEDS_CONFIRM: ReadonlySet<ActionKind> = new Set(["transfer", "remove", "leave"]);

export function actionsFor(
  member: Member,
  myId: string | undefined,
  allowed: ReadonlySet<WorkspaceAction>,
): ActionKind[] {
  if (member.userId === myId) return allowed.has("leave") ? ["leave"] : [];
  if (member.role === "owner") return [];
  const isAdmin = member.role === "admin";
  const kinds: ActionKind[] = [];
  if (!isAdmin && allowed.has("promoteMember")) kinds.push("promote");
  if (isAdmin && allowed.has("demoteAdmin")) kinds.push("demote");
  if (allowed.has("transfer")) kinds.push("transfer");
  if (allowed.has(isAdmin ? "removeAdmin" : "removeMember")) kinds.push("remove");
  return kinds;
}
