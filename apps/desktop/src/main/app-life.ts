// What closing, quitting and a computer shutdown mean (F04 design.md 3.1). No Electron here so the rules
// can be unit-tested; app-life-bridge.ts connects them to Electron.

export interface AppLifeDeps {
  /** True while a call or meeting runs in any main window (F16's controller knows). */
  inCall: () => boolean;
  /** Asks "Quit MeetApp? You'll leave the call." and answers true for Quit. */
  confirmQuitDuringCall: () => boolean;
}

export type QuitCause = "person" | "system";

export class AppLife {
  private quitting = false;
  private readonly deps: AppLifeDeps;

  constructor(deps: AppLifeDeps) {
    this.deps = deps;
  }

  /** A main window's close: hide it (the page keeps running) unless MeetApp is quitting (AC-F04-04). */
  closeHides(): boolean {
    return !this.quitting;
  }

  /**
   * Whether a quit may go ahead (AC-F04-06). The person is asked during a call; a shutdown or logout
   * never waits for a question. Once allowed, every later close and quit goes through.
   */
  mayQuit(cause: QuitCause): boolean {
    if (this.quitting) return true;
    if (cause === "person" && this.deps.inCall() && !this.deps.confirmQuitDuringCall()) return false;
    this.quitting = true;
    return true;
  }
}
