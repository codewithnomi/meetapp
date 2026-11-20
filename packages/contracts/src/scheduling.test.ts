// F13 schedule schemas: the limits the server enforces (AC-F13-10, TC-F13-11).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { scheduleAnswerBodySchema, scheduleBodySchema, scheduleUpdateBodySchema } from "./scheduling.ts";

const valid = {
  title: "Weekly sync",
  invitees: [{ userId: randomUUID() }, { email: "guest@example.test" }],
  startsAt: "2027-01-04T09:00:00Z",
  endsAt: "2027-01-04T09:30:00Z",
  allDay: false,
  timeZone: "Europe/London",
  repeat: { kind: "weekly", days: ["MO", "WE"] },
  description: "",
};
const fails = (change: object) => !scheduleBodySchema.safeParse({ ...valid, ...change }).success;

describe("schedule body", () => {
  it("TC-F13-11 [AC-F13-10] a valid body passes", () => {
    expect(scheduleBodySchema.safeParse(valid).success).toBe(true);
  });

  it("TC-F13-11 [AC-F13-10] each limit is refused", () => {
    expect(fails({ title: "  " })).toBe(true);
    expect(fails({ title: "x".repeat(101) })).toBe(true);
    expect(fails({ title: "x".repeat(100) })).toBe(false);
    expect(fails({ endsAt: valid.startsAt })).toBe(true);
    expect(fails({ endsAt: "2027-01-04T08:00:00Z" })).toBe(true);
    expect(fails({ description: "x".repeat(2001) })).toBe(true);
    expect(fails({ description: "x".repeat(2000) })).toBe(false);
    expect(fails({ invitees: [{ email: "not an email" }] })).toBe(true);
    expect(fails({ invitees: Array.from({ length: 251 }, (_, i) => ({ email: `p${i}@example.test` })) })).toBe(true);
    expect(fails({ invitees: Array.from({ length: 250 }, (_, i) => ({ email: `p${i}@example.test` })) })).toBe(false);
    expect(fails({ repeat: { kind: "hourly" } })).toBe(true);
  });

  it("TC-F13-11 [AC-F13-10] an update names the occurrence, and the end stays after the start", () => {
    expect(scheduleUpdateBodySchema.safeParse({ scope: "series", title: "New" }).success).toBe(true);
    expect(scheduleUpdateBodySchema.safeParse({ scope: "occurrence", title: "New" }).success).toBe(false);
    expect(
      scheduleUpdateBodySchema.safeParse({
        scope: "occurrence",
        originalStart: valid.startsAt,
        endsAt: "2027-01-04T08:00:00Z",
        startsAt: valid.startsAt,
      }).success,
    ).toBe(false);
    expect(scheduleAnswerBodySchema.safeParse({ answer: "none", scope: "series" }).success).toBe(false);
    expect(scheduleAnswerBodySchema.safeParse({ answer: "tentative", scope: "series" }).success).toBe(true);
  });
});
