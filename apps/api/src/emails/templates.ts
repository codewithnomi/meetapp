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
  | { kind: "someoneTried" }
  | { kind: "joinMe"; inviter: string; email: string; link: string }
  | MeetingTemplate;

/** F13 invite, update and cancellation; times already written out in the meeting's zone. */
export interface MeetingTemplate {
  kind: "meeting";
  mail: "invite" | "update" | "cancel";
  title: string;
  organizer: string;
  when: string;
  /** Empty when it doesn't repeat. */
  repeat: string;
  description: string;
  message: string;
  link: string;
  meetingNumber: string;
  passcode: string;
}

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
  /** Paragraphs whose web addresses become links in the HTML version (typed text, AC-F13-28). */
  linked?: string[];
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

/** Escapes, then turns web addresses into links (the address itself is escaped too). */
const linkify = (value: string) => escapeHtml(value).replace(URL_PATTERN, (url) => `<a href="${url}">${url}</a>`);

function render(body: Body): RenderedEmail {
  const subject = fill(body.subject, body.values, (value) => value.replace(/[<>]/g, ""));
  const textParagraphs = body.paragraphs.map((paragraph) => fill(paragraph, body.values));
  const htmlParagraphs = body.paragraphs.map(
    (paragraph) => `<p>${fill(escapeHtml(paragraph), body.values, escapeHtml)}</p>`,
  );
  const linkedText = (body.linked ?? []).filter((paragraph) => paragraph.trim() !== "");
  const linkedHtml = linkedText.map((paragraph) => `<p style="white-space:pre-wrap">${linkify(paragraph)}</p>`);
  const text = [
    messages.brand,
    "",
    ...(body.code ? [body.code, ""] : []),
    ...textParagraphs.flatMap((paragraph) => [paragraph, ""]),
    ...linkedText.flatMap((paragraph) => [paragraph, ""]),
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
    ...linkedHtml,
    button,
    `<p style="color:${EMAIL_COLORS.inkMuted};font-size:13px">${escapeHtml(messages.footer)}</p>`,
    "</body></html>",
  ].join("");
  return { subject, text, html };
}

function meetingBody(template: MeetingTemplate): Body {
  const m = messages.meeting;
  const cancel = template.mail === "cancel";
  return {
    subject: m.subject[template.mail],
    paragraphs: [
      m.intro[template.mail],
      m.when,
      ...(template.repeat ? [m.repeats] : []),
      ...(template.message ? [m.message] : []),
      ...(cancel ? [m.removedFromCalendar] : [m.howToJoin, m.addToCalendar]),
      m.why,
    ],
    values: { ...template },
    linked: cancel ? [] : [template.description],
    ...(cancel ? {} : { button: { label: m.button, link: template.link } }),
  };
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
    case "joinMe":
      return {
        subject: messages.joinMe.subject,
        paragraphs: [messages.joinMe.intro, messages.joinMe.howTo],
        values: template,
        button: { label: messages.joinMe.button, link: template.link },
      };
    case "meeting":
      return meetingBody(template);
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
