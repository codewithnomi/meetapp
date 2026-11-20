// F13 meeting emails without a mail server (AC-F13-15, 28, 30; TC-F13-09, TC-F13-71).
import { describe, expect, it } from "vitest";
import type { EmailJob, EmailResolver } from "../../emails/outbox.ts";
import { renderEmail } from "../../emails/templates.ts";
import { createMeetingMail, repeatText, whenText } from "./scheduling.mail.ts";
import type { MeetingMailDeps } from "./scheduling.mail.ts";

describe("queued meeting emails", () => {
  it("TC-F13-71 [AC-F13-30] a queued job holds only the invitee id and the kind of email, no address", async () => {
    const jobs: EmailJob[] = [];
    const resolvers = new Map<string, EmailResolver>();
    const statuses: string[] = [];
    const mail = createMeetingMail({
      outbox: {
        enqueue: async (job: EmailJob) => void jobs.push(job),
        register: (name: string, r: EmailResolver) => void resolvers.set(name, r),
      },
      scheduling: { setEmailStatus: async (_id: string, status: string) => void statuses.push(status) },
    } as unknown as MeetingMailDeps);
    await mail.send(["11111111-1111-4111-8111-111111111111"], "invite");
    expect(jobs).toEqual([
      { resolver: "meeting", data: { inviteeId: "11111111-1111-4111-8111-111111111111", mail: "invite" } },
    ]);
    expect(JSON.stringify(jobs)).not.toContain("@");
    expect(statuses).toEqual(["queued"]);
    await resolvers.get("meeting")?.settled?.({ inviteeId: "x" }, false);
    expect(statuses).toEqual(["queued", "failed"]);
  });
});

describe("meeting email text", () => {
  const template = {
    kind: "meeting" as const,
    mail: "invite" as const,
    title: "Plan <b>x</b>",
    organizer: "Aisha <Khan>",
    when: whenText(new Date("2027-01-04T09:00:00Z"), new Date("2027-01-04T09:30:00Z"), "Europe/London", false),
    repeat: repeatText("FREQ=WEEKLY;BYDAY=MO,WE", new Date("2027-03-01T00:00:00Z"), "Europe/London"),
    description: "See https://example.test/a?b=1&c=2 <script>alert(1)</script>",
    message: "",
    link: "https://meetapp.test/m/abc",
    meetingNumber: "123456789012",
    passcode: "Ab3dE5",
  };

  it("TC-F13-09 [AC-F13-28] typed text is escaped in HTML, links in it are clickable, the subject has no angle brackets", () => {
    const email = renderEmail(template);
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("Plan &lt;b&gt;x&lt;/b&gt;");
    expect(email.html).toContain('<a href="https://example.test/a?b=1&amp;c=2">');
    expect(email.subject).not.toMatch(/[<>]/);
    expect(email.text).toContain("<script>alert(1)</script>");
  });

  it("TC-F13-52 [AC-F13-15] time with its zone, the repeat, join details and why", () => {
    expect(template.when).toBe("Mon, 4 Jan 2027, 09:00–09:30 (Europe/London)");
    expect(template.repeat).toBe("Weekly on Mon, Wed until 1 Mar 2027");
    expect(repeatText("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", null, "UTC")).toBe("Every weekday");
    expect(whenText(new Date("2027-01-04T00:00:00Z"), new Date("2027-01-05T00:00:00Z"), "UTC", true)).toBe(
      "Mon, 4 Jan 2027 (all day)",
    );
    const { text } = renderEmail(template);
    expect(text).toContain("123456789012");
    expect(text).toContain("Ab3dE5");
    expect(text).toContain("Join the meeting: https://meetapp.test/m/abc");
    expect(text).toContain("added your address to a MeetApp meeting");
    const cancel = renderEmail({ ...template, mail: "cancel", message: "Moved to Friday" });
    expect(cancel.subject).toMatch(/^Cancelled:/);
    expect(cancel.text).toContain("Moved to Friday");
    expect(cancel.text).not.toContain("Join the meeting");
  });
});
