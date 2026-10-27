// CallingScreen (template): the dark stage while a call rings, and its end ("Declined", "No answer")
// (F15 AC-F15-01, 07, 08; approved canvas). Slots only: the page fills the words, the picture, the
// person's own preview, the outcome buttons and the call controls.
import type { ReactNode } from "react";
import { cx } from "../../lib/cx.ts";

export interface CallingScreenProps {
  /** "Video call · Bilal Ahmed". */
  heading: string;
  /** The person called (an avatar), with a ring around it while ringing. */
  picture: ReactNode;
  ringing: boolean;
  /** "Calling Bilal Ahmed…", "Bilal Ahmed declined", "No answer". */
  title: string;
  /** "Ringing. They can accept with video or audio." */
  line: string;
  /** Call again, Back to chat (after an outcome). */
  actions?: ReactNode;
  /** The person's own camera preview with its caption. */
  preview?: ReactNode;
  /** The call controls (mute, camera, devices, Cancel). */
  controls: ReactNode;
}

export function CallingScreen(props: CallingScreenProps) {
  return (
    <div className="box-border flex min-h-full flex-col bg-stage font-sans text-stage-ink">
      <header className="px-6 py-4">
        <h1 className="m-0 text-[17px] leading-6 font-semibold">{props.heading}</h1>
      </header>
      <div className="flex flex-1 flex-wrap items-center justify-center gap-6 px-6 py-2">
        <section role="status" className="flex max-w-140 flex-[1_1_420px] flex-col items-center gap-4.5 text-center">
          <span
            className={cx("rounded-full p-4.5", props.ringing && "ring-2 ring-accent ring-offset-8 ring-offset-stage")}
          >
            {props.picture}
          </span>
          <h2 className="m-0 text-[26px] leading-8 font-bold">{props.title}</h2>
          <p className="m-0 text-[15px] leading-5.5 opacity-85">{props.line}</p>
          {props.actions ? <div className="flex flex-wrap justify-center gap-2.5">{props.actions}</div> : null}
        </section>
        {props.preview ? <div className="flex-[0_1_320px]">{props.preview}</div> : null}
      </div>
      <footer className="px-6 pt-4 pb-5">{props.controls}</footer>
    </div>
  );
}
