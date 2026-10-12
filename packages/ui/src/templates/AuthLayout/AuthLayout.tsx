// AuthLayout (template): the signed-out screens of the approved canvas (Sign in, Create account, Code,
// New password, Terms). Two halves that wrap on narrow windows: the dark stage with the wordmark and a
// slot on the left, and the form, centered and at most 380px wide, on the right. Also the two pieces
// those screens share on the stage: the decorative call tiles and the numbered steps.
import type { ReactNode } from "react";
import { Icon } from "../../atoms/Icon/index.ts";
import { cx } from "../../lib/cx.ts";

export interface AuthLayoutProps {
  /** The product name, set as the wordmark until a logo exists. */
  brand: string;
  /** The stage's content below the wordmark (tiles and a headline, steps, …). */
  aside: ReactNode;
  /** The form. */
  children: ReactNode;
}

export function AuthLayout({ brand, aside, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-wrap bg-bg text-ink">
      <section className="box-border flex min-w-0 flex-[1_1_480px] flex-col justify-between gap-10 bg-stage p-14 text-stage-ink">
        <div className="text-[22px] font-bold tracking-[-0.01em]">{brand}</div>
        {aside}
      </section>
      <main className="box-border flex min-w-0 flex-[1_1_420px] items-center justify-center px-6 py-14">
        <div className="flex w-full max-w-95 flex-col gap-5">{children}</div>
      </main>
    </div>
  );
}

/** The decorative call tiles, with a headline and a line below them. */
export function AuthTiles({ headline, description }: { headline: string; description: string }) {
  const tile = "aspect-video rounded-lg bg-stage-tile";
  return (
    <>
      <div aria-hidden="true" className="grid max-w-115 grid-cols-3 gap-3">
        <div className="col-span-2 aspect-[32/9] rounded-lg bg-accent" />
        <div className={tile} />
        <div className={tile} />
        <div className={cx(tile, "shadow-[inset_0_0_0_3px_var(--speaking)]")} />
        <div className="aspect-video rounded-lg bg-accent-soft" />
      </div>
      <div className="flex max-w-115 flex-col gap-3">
        <h2 className="m-0 text-display text-balance tracking-[-0.02em]">{headline}</h2>
        <p className="m-0 text-body opacity-85">{description}</p>
      </div>
    </>
  );
}

export interface AuthStep {
  title: string;
  description?: string;
  state: "done" | "current" | "next";
}

/** Numbered steps: finished ones show a tick, the current one is filled with the accent. */
export function AuthSteps({ steps, footer }: { steps: readonly AuthStep[]; footer?: string }) {
  return (
    <>
      <ol className="m-0 flex max-w-105 list-none flex-col gap-5 p-0">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex items-start gap-3.5"
            aria-current={step.state === "current" ? "step" : undefined}
          >
            <span
              className={cx(
                "grid size-8 flex-none place-items-center rounded-full font-bold",
                step.state === "current" ? "bg-accent text-on-accent" : "bg-stage-tile",
              )}
            >
              {step.state === "done" ? <Icon name="check" size={18} /> : index + 1}
            </span>
            <span className="flex flex-col gap-0.5 pt-1">
              <span className="font-[650]">{step.title}</span>
              {step.description ? <span className="text-[14px] opacity-80">{step.description}</span> : null}
            </span>
          </li>
        ))}
      </ol>
      {footer ? <p className="m-0 max-w-105 text-[13px] leading-4.5 opacity-75">{footer}</p> : null}
    </>
  );
}
