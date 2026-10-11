// The emails MeetApp sends in F01 (design.md section 10, AC-F01-27). Every word comes from
// locales/en.json; names typed by people are escaped in the HTML version (AC-F01-35) and stripped of
// angle brackets in subjects. Each email has a plain-text version for mail apps that don't show HTML.
import { EMAIL_COLORS } from "./colors.ts";
import messages from "./locales/en.json" with { type: "json" };

type CodePurpose = "sign-up" | "sign-in" | "reset";

export type EmailTemplate =
  | { kind: "code"; purpose: CodePurpose; code: string }
  | { kind: "invitation"; inviter: string; workspace: string; role: "admin" | "member"; email: string; link: string }
  | { kind: "joinRequest"; person: string; email: string; workspace: string }
  | { kind: "requestDecided"; outcome: "approved" | "rejected"; workspace: string }
  | { kind: "someoneTried" };

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

type Values = Record<string, string>;

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

/** Fills {{name}} placeholders. */
function fill(template: string, values: Values, encode: (value: string) => string = (value) => value): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => encode(values[key] ?? ""));
}

/** One email from its paragraphs (already worded), with an optional highlighted code and button. */
interface Body {
  subject: string;
  paragraphs: string[];
  values: Values;
  code?: string;
  button?: { label: string; link: string };
}

function render(body: Body): RenderedEmail {
  const subject = fill(body.subject, body.values, (value) => value.replace(/[<>]/g, ""));
  const textParagraphs = body.paragraphs.map((paragraph) => fill(paragraph, body.values));
  const htmlParagraphs = body.paragraphs.map(
    (paragraph) => `<p>${fill(escapeHtml(paragraph), body.values, escapeHtml)}</p>`,
  );
  const text = [
    messages.brand,
    "",
    ...(body.code ? [body.code, ""] : []),
    ...textParagraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(body.button ? [`${body.button.label}: ${body.button.link}`, ""] : []),
    messages.footer,
  ].join("\n");
  const code = body.code
    ? `<p style="font-size:28px;letter-spacing:6px;margin:16px 0"><strong>${escapeHtml(body.code)}</strong></p>`
    : "";
  const button = body.button
    ? `<p><a href="${escapeHtml(body.button.link)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:${EMAIL_COLORS.accent};color:${EMAIL_COLORS.onAccent};text-decoration:none">${escapeHtml(body.button.label)}</a></p>`
    : "";
  const html = [
    `<!doctype html><html lang="en"><body style="font-family:Figtree,Arial,sans-serif;color:${EMAIL_COLORS.ink}">`,
    `<p style="font-size:20px;font-weight:700">${messages.brand}</p>`,
    code,
    ...htmlParagraphs,
    button,
    `<p style="color:${EMAIL_COLORS.inkMuted};font-size:13px">${escapeHtml(messages.footer)}</p>`,
    "</body></html>",
  ].join("");
  return { subject, text, html };
}

function bodyFor(template: EmailTemplate): Body {
  switch (template.kind) {
    case "code":
      return {
        subject: messages.code.subject[template.purpose],
        paragraphs: [messages.code.intro[template.purpose], messages.code.validity, messages.ignoreIfNotYou],
        values: { code: template.code },
        code: template.code,
      };
    case "invitation":
      return {
        subject: messages.invitation.subject,
        paragraphs: [messages.invitation.intro, messages.invitation.howTo, messages.invitation.validity],
        values: { ...template, role: messages.roles[template.role] },
        button: { label: messages.invitation.button, link: template.link },
      };
    case "joinRequest":
      return {
        subject: messages.joinRequest.subject,
        paragraphs: [messages.joinRequest.intro, messages.joinRequest.howTo, messages.joinRequest.validity],
        values: template,
      };
    case "requestDecided":
      return {
        subject: messages.requestDecided.subject[template.outcome],
        paragraphs: [messages.requestDecided.intro[template.outcome]],
        values: template,
      };
    case "someoneTried":
      return {
        subject: messages.someoneTried.subject,
        paragraphs: [messages.someoneTried.intro, messages.someoneTried.howTo, messages.someoneTried.notYou],
        values: {},
      };
  }
}

export function renderEmail(template: EmailTemplate): RenderedEmail {
  return render(bodyFor(template));
}
