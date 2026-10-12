// The title and line below it on every sign-in screen (approved canvas). The title takes keyboard focus
// after a screen change, so screen-reader users hear where they are.
import type { ReactNode } from "react";

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 tabIndex={-1} className="m-0 text-title outline-none">
        {title}
      </h1>
      {children ? <p className="m-0 text-body text-ink-muted">{children}</p> : null}
    </div>
  );
}
