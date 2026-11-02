// When someone is removed from a team workspace or leaves it (F14 AC-F14-34; design 3.10): they leave
// all its chats at once with a "<name> left" note, keep reading what they saw, and their one-to-one
// chats there turn read-only for the other person ("This person is no longer in the workspace").
// Their live line stops following those chats within 2 seconds.
import { saveNote } from "./chats-notes.ts";
import type { GroupsDeps } from "./chats-groups.service.ts";

async function forgetMembership(deps: GroupsDeps, workspaceId: string, userId: string) {
  const rows = await deps.groups.inWorkspace(workspaceId, userId);
  for (const { conversation } of rows) {
    const people = await deps.chats.peopleOf([conversation.id]);
    const me = { id: userId, name: people.find((p) => p.userId === userId)?.name ?? "" };
    await saveNote(deps, conversation, me, { event: "left" });
    await deps.groups.stop(conversation.id, userId, "left", await deps.chat.lastSeq(conversation.id));
    const others = people.filter((p) => p.userId !== userId && p.state === "accepted").map((p) => p.userId);
    await deps.live.list(others, conversation.id, "changed");
    await deps.live.list([userId], conversation.id, "removed");
    await deps.calls.leftChat(conversation.id, userId);
    if (conversation.kind === "group" && others.length === 0) await deps.groups.markDeleted(conversation.id);
  }
  // Their line, and their former colleagues' lines, re-read whose status they may see (AC-F14-26).
  const colleagues = (await deps.chats.workspacePeople(workspaceId)).map((p) => p.userId);
  await Promise.all([userId, ...colleagues].map((id) => deps.live.control(id, { control: "refresh" })));
}

export function createChatsMembershipService(deps: GroupsDeps) {
  return { forgetMembership: (workspaceId: string, userId: string) => forgetMembership(deps, workspaceId, userId) };
}
