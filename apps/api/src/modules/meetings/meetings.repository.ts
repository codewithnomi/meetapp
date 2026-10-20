// Meetings: database access only (F02 design.md sections 3.1 and 4). Every read of a meeting goes
// through its id together with a check of who asks (the service), and every list filters by workspace
// (S2). A meeting ID already taken is drawn again.
import {
  meetingCoOrganizers,
  meetings,
  user,
  workspaceMembers,
  workspaces,
  type Executor,
  type Meeting,
} from "@meetapp/db";
import { and, eq, inArray } from "drizzle-orm";

/** Services take the row type from here, not from the database package (layering rule). */
export type { Meeting } from "@meetapp/db";

export type NewMeeting = Omit<typeof meetings.$inferInsert, "id" | "createdAt" | "updatedAt">;

/** Fields left out (or undefined) stay as they are. */
export interface MeetingOptionsChange {
  title?: string | undefined;
  lobbyBypass?: Meeting["lobbyBypass"] | undefined;
  whoCanPresent?: Meeting["whoCanPresent"] | undefined;
  allowAttendeeMic?: boolean | undefined;
  allowAttendeeCamera?: boolean | undefined;
  expiresAt?: Date | undefined;
}

/** A meeting with what the service needs to decide: its organizer's name and current membership. */
export interface MeetingRow {
  meeting: Meeting;
  organizerName: string;
  workspaceKind: "personal" | "company";
  /** The workspace lets guests join its meetings (AC-F02-40). */
  allowGuests: boolean;
  /** False when the organizer left (or was removed from) the meeting's workspace (AC-F02-07). */
  organizerIsMember: boolean;
  coOrganizerIds: string[];
}

const UNIQUE_VIOLATION = "23505";
const MAX_NUMBER_DRAWS = 5;

function isNumberTaken(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string; constraint?: string } }).cause ?? error;
  const { code, constraint } = cause as { code?: string; constraint?: string };
  return code === UNIQUE_VIOLATION && constraint === "meetings_meeting_number_unique";
}

/** Only co-organizers who are still members of the meeting's workspace count (AC-F02-36, S2). */
async function coOrganizersOf(executor: Executor, meetingId: string, workspaceId: string): Promise<string[]> {
  const rows = await executor
    .select({ userId: meetingCoOrganizers.userId })
    .from(meetingCoOrganizers)
    .innerJoin(
      workspaceMembers,
      and(eq(workspaceMembers.userId, meetingCoOrganizers.userId), eq(workspaceMembers.workspaceId, workspaceId)),
    )
    .where(eq(meetingCoOrganizers.meetingId, meetingId));
  return rows.map((row) => row.userId);
}

/** Inserts the meeting; a taken meeting ID is drawn again (`build` makes the values for each draw). */
async function insertMeeting(executor: Executor, build: () => NewMeeting): Promise<Meeting> {
  for (let draw = 1; ; draw++) {
    try {
      const [row] = await executor.insert(meetings).values(build()).returning();
      if (!row) throw new Error("no meeting row");
      return row;
    } catch (error) {
      if (!isNumberTaken(error) || draw >= MAX_NUMBER_DRAWS) throw error;
    }
  }
}

async function findMeeting(executor: Executor, meetingId: string): Promise<MeetingRow | undefined> {
  const [row] = await executor
    .select({
      meeting: meetings,
      organizerName: user.name,
      workspaceKind: workspaces.kind,
      allowGuests: workspaces.allowGuests,
      membership: workspaceMembers.id,
    })
    .from(meetings)
    .innerJoin(user, eq(user.id, meetings.organizerId))
    .innerJoin(workspaces, eq(workspaces.id, meetings.workspaceId))
    .leftJoin(
      workspaceMembers,
      and(eq(workspaceMembers.workspaceId, meetings.workspaceId), eq(workspaceMembers.userId, meetings.organizerId)),
    )
    .where(eq(meetings.id, meetingId));
  if (!row) return undefined;
  return {
    meeting: row.meeting,
    organizerName: row.organizerName,
    workspaceKind: row.workspaceKind,
    allowGuests: row.allowGuests,
    organizerIsMember: row.membership !== null,
    coOrganizerIds: await coOrganizersOf(executor, meetingId, row.meeting.workspaceId),
  };
}

export function createMeetingsRepository(executor: Executor) {
  return {
    insert: (build: () => NewMeeting) => insertMeeting(executor, build),
    find: (meetingId: string) => findMeeting(executor, meetingId),
    /** The meeting whose link has this lookup hash. */
    idByLinkLookup: async (linkLookup: string): Promise<string | undefined> => {
      const [row] = await executor
        .select({ id: meetings.id })
        .from(meetings)
        .where(eq(meetings.linkLookup, linkLookup));
      return row?.id;
    },
    /** The meeting with this ID, with its passcode check (compared by the service). */
    byNumber: async (meetingNumber: string): Promise<{ id: string; passcodeCheck: string } | undefined> => {
      const [row] = await executor
        .select({ id: meetings.id, passcodeCheck: meetings.passcodeCheck })
        .from(meetings)
        .where(eq(meetings.meetingNumber, meetingNumber));
      return row;
    },
    update: async (meetingId: string, change: MeetingOptionsChange): Promise<void> => {
      if (Object.keys(change).length === 0) return;
      await executor.update(meetings).set(change).where(eq(meetings.id, meetingId));
    },
    /** Replaces the co-organizers in one step (the database keeps the limit of 10). */
    setCoOrganizers: (meetingId: string, userIds: string[]): Promise<void> =>
      executor.transaction(async (tx) => {
        await tx.delete(meetingCoOrganizers).where(eq(meetingCoOrganizers.meetingId, meetingId));
        if (userIds.length > 0) {
          await tx.insert(meetingCoOrganizers).values(userIds.map((userId) => ({ meetingId, userId })));
        }
      }),
    /** Which of these people are members of the workspace (co-organizers must be, AC-F02-36). */
    membersAmong: async (workspaceId: string, userIds: string[]): Promise<string[]> => {
      if (userIds.length === 0) return [];
      const rows = await executor
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspaceId), inArray(workspaceMembers.userId, userIds)));
      return rows.map((row) => row.userId);
    },
  };
}

export type MeetingsRepository = ReturnType<typeof createMeetingsRepository>;
