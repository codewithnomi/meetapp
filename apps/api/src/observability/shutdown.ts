// Work that must finish before the backend exits, such as sending the last traces and logs, which
// OpenTelemetry batches for up to 5 s. instrumentation.ts registers it; server.ts runs it on stop, just
// before process.exit() (which would otherwise drop it). A hook that hangs can't block the stop.
type ShutdownHook = () => Promise<unknown>;

const hooks: ShutdownHook[] = [];

export function onShutdown(hook: ShutdownHook): void {
  hooks.push(hook);
}

/** Runs every hook at once and waits for all of them, or at most `timeoutMs`. Failures are ignored. */
export async function runShutdownHooks(timeoutMs = 5000): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  await Promise.race([Promise.allSettled(hooks.map(async (hook) => hook())), timeout]);
  clearTimeout(timer);
}
