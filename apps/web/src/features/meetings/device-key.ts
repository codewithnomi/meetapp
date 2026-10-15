// This app's device key (F02 design.md section 5): the desktop app keeps it and hands it over through
// `window.meetapp.deviceKey()`. In a plain browser there is none (the web app comes with F10).
interface DeviceKeyBridge {
  meetapp?: { deviceKey?: () => Promise<string> };
}

export async function deviceKey(): Promise<string | undefined> {
  const bridge = (window as DeviceKeyBridge).meetapp;
  return bridge?.deviceKey ? bridge.deviceKey().catch(() => undefined) : undefined;
}
