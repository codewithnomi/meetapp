// This app's device key (F02 design.md section 5): the desktop app keeps it and hands it over through
// `window.meetapp.deviceKey()`. A plain browser has none until the web app (F10); there a random key
// lives for this window only, so joining still works.
interface DeviceKeyBridge {
  meetapp?: { deviceKey?: () => Promise<string> };
}

let windowKey: string | undefined;

function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function deviceKey(): Promise<string | undefined> {
  const bridge = (window as DeviceKeyBridge).meetapp;
  return bridge?.deviceKey ? bridge.deviceKey().catch(() => undefined) : undefined;
}

/** For joining, which needs a key: the desktop's, or this window's own. */
export async function meetingDeviceKey(): Promise<string> {
  return (await deviceKey()) ?? (windowKey ??= randomKey());
}
