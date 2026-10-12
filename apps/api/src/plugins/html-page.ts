// The few plain web pages the backend serves to browsers (F01: the Google/Microsoft hand-off page and
// the invitation page). No scripts at all; the one style block is allowed by its hash, so the security
// policy can forbid everything else. Never cached, never sent on as a referrer, never indexed.
import { createHash } from "node:crypto";
import { EMAIL_COLORS } from "../emails/colors.ts";

const BASE_STYLE = `body{font-family:system-ui,sans-serif;color:${EMAIL_COLORS.ink};max-width:28rem;margin:4rem auto;padding:0 1rem;text-align:center}
p{color:${EMAIL_COLORS.inkMuted};line-height:1.5}`;

/** Text and double-quoted attributes only, so these four characters are enough. */
export const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (character) => `&#${String(character.charCodeAt(0))};`);

export interface HtmlPage {
  /** The page's own CSS, added after the shared rules. */
  style: string;
  /** Allowed form targets; none when the page has no form. */
  formAction?: "'self'";
}

/** Renders pages of one kind; `headers` go with every one of them. */
export function htmlPages({ style, formAction }: HtmlPage) {
  const css = `${BASE_STYLE}\n${style}`;
  const hash = createHash("sha256").update(css).digest("base64");
  const forms = formAction ? `form-action ${formAction}` : "form-action 'none'";
  return {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
      "content-security-policy": `default-src 'none'; style-src 'sha256-${hash}'; ${forms}; frame-ancestors 'none'; base-uri 'none'`,
    },
    /** `title` and `heading` are escaped here; `body` is HTML the caller has already escaped. */
    layout: (title: string, heading: string, body: string) =>
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${css}</style></head><body><h1>${escapeHtml(heading)}</h1>${body}</body></html>`,
  };
}
