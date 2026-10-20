// Links in chat open in the person's browser (AC-F03-04): the desktop app sends any new window outside
// (guards.ts), and only web links reach here (the message renderer checks).
export function openLink(href: string): void {
  window.open(href, "_blank", "noopener,noreferrer");
}
