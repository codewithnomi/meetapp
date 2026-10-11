// The browser page of the desktop hand-off (F01 design.md section 4): confirm with the 4-digit code,
// "You can close this tab", or why it stopped. Plain HTML with no scripts; words in locales/en.json,
// colors from the design tokens. Served with no caching, no referrer and a strict security policy.
import { createHash } from "node:crypto";
import { EMAIL_COLORS } from "../../../emails/colors.ts";
import type { BrowserPage } from "../desktop-sign-in.service.ts";
import words from "./locales/en.json" with { type: "json" };

const STYLE = `body{font-family:system-ui,sans-serif;color:${EMAIL_COLORS.ink};max-width:28rem;margin:4rem auto;padding:0 1rem;text-align:center}
p{color:${EMAIL_COLORS.inkMuted};line-height:1.5}
.code{font-size:2.5rem;font-weight:700;letter-spacing:.3em;color:${EMAIL_COLORS.ink}}
button{font:inherit;font-weight:600;border-radius:999px;padding:.6rem 1.4rem;margin:.3rem;cursor:pointer;border:1px solid ${EMAIL_COLORS.inkMuted};background:none;color:${EMAIL_COLORS.ink}}
button[value=continue]{background:${EMAIL_COLORS.accent};color:${EMAIL_COLORS.onAccent};border-color:transparent}`;
const STYLE_HASH = createHash("sha256").update(STYLE).digest("base64");

/** Headers for every hand-off page (TC-F01-17): nothing cached, nothing leaked, nothing framed. */
export const PAGE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex",
  "content-security-policy": `default-src 'none'; style-src 'sha256-${STYLE_HASH}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
} as const;

/** Text and double-quoted attributes only, so these four characters are enough. */
const escape = (text: string) => text.replace(/[&<>"]/g, (character) => `&#${String(character.charCodeAt(0))};`);

function layout(heading: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(words.title)}</title><style>${STYLE}</style></head><body><h1>${escape(heading)}</h1>${body}</body></html>`;
}

function confirmPage(requestId: string, matchCode: string): string {
  const { confirm } = words;
  return layout(
    confirm.heading,
    `<p>${escape(confirm.code)}</p><p class="code">${escape(matchCode)}</p>` +
      `<form method="post" action="/api/v1/auth/desktop/done"><input type="hidden" name="request" value="${escape(requestId)}">` +
      `<button type="submit" name="action" value="continue">${escape(confirm.continue)}</button>` +
      `<button type="submit" name="action" value="cancel">${escape(confirm.cancel)}</button></form>`,
  );
}

/** The HTML for what the browser shows next. */
export function renderDesktopSignInPage(requestId: string, page: BrowserPage): string {
  switch (page.page) {
    case "confirm":
      return confirmPage(requestId, page.matchCode);
    case "done":
      return layout(words.done.heading, `<p>${escape(words.done.body)}</p>`);
    case "cancelled": {
      const reasons = words.cancelled as Record<string, string>;
      return layout(
        words.cancelled.heading,
        `<p>${escape(reasons[page.reason] ?? words.cancelled.SIGN_IN_CANCELLED)}</p>`,
      );
    }
    case "invalid":
      return layout(words.invalid.heading, `<p>${escape(words.invalid.body)}</p>`);
  }
}
