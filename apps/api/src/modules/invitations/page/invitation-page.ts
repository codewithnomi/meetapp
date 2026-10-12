// The invitation web page the email's button opens (F01 design.md section 2, AC-F01-18, 35): who
// invited which (masked) email to which workspace, and where to get MeetApp. No forms, no sign-in, no
// scripts; names are shown as text. Every unusable invitation gets the same page.
import { EMAIL_COLORS } from "../../../emails/colors.ts";
import { escapeHtml, htmlPages } from "../../../plugins/html-page.ts";
import words from "./locales/en.json" with { type: "json" };

/** Until MeetApp has its own website (hosting decision), the app comes from the project's releases. */
export const GET_MEETAPP_URL = "https://github.com/codewithnomi/meetapp/releases/latest";

const pages = htmlPages({
  style: `a{display:inline-block;margin-top:1rem;font-weight:600;border-radius:999px;padding:.6rem 1.4rem;text-decoration:none;background:${EMAIL_COLORS.accent};color:${EMAIL_COLORS.onAccent}}`,
});

export const INVITATION_PAGE_HEADERS = pages.headers;

export type InvitationPage =
  { page: "valid"; workspaceName: string; inviterName: string | null; email: string } | { page: "invalid" };

/** `pat@example.test` → `p***@example.test`: enough to recognise, not enough to collect. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  return `${email.slice(0, Math.min(1, at))}***${email.slice(at)}`;
}

/** Fills {{name}} placeholders with escaped values (the words themselves are escaped too). */
const fill = (text: string, values: Record<string, string>) =>
  escapeHtml(text).replace(/\{\{(\w+)\}\}/g, (_match, key: string) => escapeHtml(values[key] ?? ""));

export function renderInvitationPage(page: InvitationPage): string {
  if (page.page === "invalid") {
    return pages.layout(words.title, words.invalid.heading, `<p>${escapeHtml(words.invalid.body)}</p>`);
  }
  const values = { workspace: page.workspaceName, inviter: page.inviterName ?? "", email: maskEmail(page.email) };
  const invited = page.inviterName === null ? words.valid.invitedByUnknown : words.valid.invitedBy;
  const body =
    `<p>${fill(invited, values)}</p><p>${escapeHtml(words.valid.howTo)}</p>` +
    `<a href="${escapeHtml(GET_MEETAPP_URL)}" rel="noreferrer">${escapeHtml(words.valid.getApp)}</a>`;
  const heading = words.valid.heading.replace("{{workspace}}", () => page.workspaceName);
  return pages.layout(words.title, heading, body);
}
