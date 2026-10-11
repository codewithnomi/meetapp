// TC-F01-70 (AC-F01-27, AC-F01-35): every email MeetApp sends in F01 has an HTML and a plain-text
// version, says how long it is valid, never asks for a password, takes its words from the translation
// file, and shows names only as text.
import { describe, expect, it } from "vitest";
import messages from "./locales/en.json" with { type: "json" };
import { renderEmail, type EmailTemplate } from "./templates.ts";

const EVIL = "<script>alert(1)</script>";

const SAMPLES: EmailTemplate[] = [
  { kind: "code", purpose: "sign-up", code: "482913" },
  { kind: "code", purpose: "sign-in", code: "482913" },
  { kind: "code", purpose: "reset", code: "482913" },
  {
    kind: "invitation",
    inviter: EVIL,
    workspace: EVIL,
    role: "member",
    email: "new.person@example.test",
    link: "http://127.0.0.1:3000/invite/abc",
  },
  { kind: "joinRequest", person: EVIL, email: "asker@example.test", workspace: EVIL },
  { kind: "requestDecided", outcome: "approved", workspace: EVIL },
  { kind: "requestDecided", outcome: "rejected", workspace: EVIL },
  { kind: "someoneTried" },
];

/** Every string in the translation file, with its {{placeholders}} removed. */
function translatedPieces(): string[] {
  const pieces: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") pieces.push(...value.split(/\{\{\w+\}\}/).filter((part) => part.trim().length > 3));
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(messages);
  return pieces;
}

describe("TC-F01-70 [AC-F01-27] [AC-F01-35] email templates", () => {
  it.each(SAMPLES.map((sample) => [`${sample.kind}${"purpose" in sample ? `/${sample.purpose}` : ""}`, sample]))(
    "TC-F01-70 [AC-F01-27] %s has a subject, HTML and plain text, the MeetApp name, and never asks for a password",
    (_name, sample) => {
      const email = renderEmail(sample as EmailTemplate);
      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.html).toContain("<html");
      expect(email.text.length).toBeGreaterThan(0);
      for (const part of [email.html, email.text]) {
        expect(part).toContain(messages.brand);
        expect(part).not.toMatch(/(enter|type|send|reply with) your password/i);
      }
    },
  );

  it("TC-F01-70 [AC-F01-27] code emails show the code prominently, say 15 minutes and 'ignore this email'", () => {
    const email = renderEmail({ kind: "code", purpose: "sign-in", code: "482913" });
    expect(email.subject).toContain("482913");
    expect(email.html).toMatch(/<strong[^>]*>482913<\/strong>/);
    for (const part of [email.html, email.text]) {
      expect(part).toContain("15 minutes");
      expect(part).toContain("ignore this email");
    }
  });

  it("TC-F01-70 [AC-F01-27] invitations say 7 days; join requests say 14 days", () => {
    const invitation = renderEmail(SAMPLES[3] as EmailTemplate);
    expect(invitation.text).toContain("7 days");
    expect(invitation.html).toContain('href="http://127.0.0.1:3000/invite/abc"');
    expect(renderEmail(SAMPLES[4] as EmailTemplate).text).toContain("14 days");
  });

  it("TC-F01-70 [AC-F01-35] HTML in names is escaped in the HTML version and stays inert text in the plain version", () => {
    // The samples with names typed by people (all but the code emails and "someone tried").
    for (const sample of SAMPLES.filter((item) => item.kind !== "code" && item.kind !== "someoneTried")) {
      const email = renderEmail(sample);
      expect(email.html).not.toContain(EVIL);
      expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(email.subject).not.toMatch(/[<>]/);
    }
  });

  it("TC-F01-70 [AC-F01-27] the wording comes from the translation file", () => {
    const pieces = translatedPieces();
    for (const sample of SAMPLES) {
      const { text } = renderEmail(sample);
      const lines = text.split("\n").filter((line) => /[a-z]{4}/i.test(line) && !line.includes("http"));
      for (const line of lines) {
        expect(
          pieces.some((piece) => line.includes(piece.trim())),
          `"${line}" is not from en.json`,
        ).toBe(true);
      }
    }
  });
});
