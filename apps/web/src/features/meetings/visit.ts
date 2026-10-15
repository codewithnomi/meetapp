// The person's current visit to a meeting (F02 design.md section 3.3): what joining answered, kept in the
// app's memory only, never on disk, and gone when the window closes (AC-F02-54). The meeting ticket
// in it proves the visit to the backend on every lobby and call request.
import type { attendanceSchema, joinedSchema } from "@meetapp/contracts";
import type { z } from "zod";
import { create } from "zustand";

export type Joined = z.infer<typeof joinedSchema>;
export type Attendance = z.infer<typeof attendanceSchema>;

interface VisitState {
  visit: Joined | undefined;
  start: (joined: Joined) => void;
  /** A newer status from the backend; the ticket stays. */
  update: (attendance: Attendance) => void;
  end: () => void;
}

export const useVisit = create<VisitState>((set) => ({
  visit: undefined,
  start: (joined) => set({ visit: joined }),
  update: (attendance) => set(({ visit }) => (visit ? { visit: { ...visit, ...attendance } } : {})),
  end: () => set({ visit: undefined }),
}));
