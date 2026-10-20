// The visit lives in memory only and keeps its ticket when the status changes (AC-F02-54).
import { beforeEach, describe, expect, it } from "vitest";
import { VISIT } from "./fake-visit.ts";
import { useVisit } from "./visit.ts";

beforeEach(() => useVisit.setState({ visit: undefined }));

describe("visit", () => {
  it("TC-F02-93 [AC-F02-54] starts, takes a newer status with the same ticket, and ends", () => {
    useVisit.getState().start(VISIT);
    useVisit.getState().update({ attendanceId: VISIT.attendanceId, status: "admitted" } as never);
    expect(useVisit.getState().visit).toMatchObject({ status: "admitted", ticket: "ticket-1", title: "Budget review" });
    useVisit.getState().end();
    expect(useVisit.getState().visit).toBeUndefined();
  });

  it("TC-F02-93 [AC-F02-54] a status with no visit does not make one", () => {
    useVisit.getState().update({ attendanceId: "x", status: "admitted" } as never);
    expect(useVisit.getState().visit).toBeUndefined();
  });

  it("TC-F02-93 [AC-F02-54] nothing is written to disk", () => {
    useVisit.getState().start(VISIT);
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain("ticket-1");
  });
});
