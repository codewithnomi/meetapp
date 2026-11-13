// The Mac and Windows installers (D084). Unsigned until a certificate is set through CSC_LINK and
// CSC_KEY_PASSWORD: signing is only settings, never a code change (AC-F04-03). Updates stay off (AC-50).
import type { Configuration } from "electron-builder";
import { appIdentity } from "./app-identity.ts";

// Electron's switches turned off in the installed app (security review): another program can't run
// MeetApp as plain Node.js, or open a debugger in it, to borrow its camera and microphone permission;
// only the app's own checked archive is loaded. Set before signing, so the signature covers them.
const FUSES: NonNullable<Configuration["electronFuses"]> = {
  runAsNode: false,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
  enableCookieEncryption: true,
  enableEmbeddedAsarIntegrityValidation: true,
  onlyLoadAppFromAsar: true,
  grantFileProtocolExtraPrivileges: false,
};

export function builderConfig(env: NodeJS.ProcessEnv): Configuration {
  const signed = Boolean(env["CSC_LINK"]);
  return {
    appId: appIdentity.appId,
    productName: appIdentity.productName,
    directories: { output: "release", buildResources: "build-resources" },
    // Sentry's build-time code parser (native, one chip per copy) is never used by the running app,
    // and would break the universal Mac build.
    files: [
      "out/**",
      "package.json",
      "build-resources/icon.png",
      "build-resources/trayTemplate*.png",
      "!**/node_modules/oxc-parser/**",
      "!**/node_modules/@oxc-parser/**",
    ],
    // The screens (apps/web/dist) sit next to the app, where settings.ts looks for them.
    extraResources: [{ from: "../web/dist", to: "web/dist" }],
    protocols: [{ name: `${appIdentity.productName} meeting link`, schemes: [appIdentity.linkScheme] }],
    icon: appIdentity.icon,
    publish: null,
    electronFuses: FUSES,
    mac: {
      target: [{ target: "dmg", arch: "universal" }],
      category: "public.app-category.business",
      // Without a certificate: an ad-hoc signature ("-", made on this Mac, no Apple account) under the app's
      // own id, so macOS remembers camera and microphone answers (T19: with no signature it asked again and
      // again). undefined lets electron-builder use the certificate from CSC_LINK.
      ...(signed ? {} : { identity: "-" }),
      // Under the hardened runtime the app must name the camera and microphone, or macOS refuses them.
      entitlements: "build-resources/entitlements.mac.plist",
      entitlementsInherit: "build-resources/entitlements.mac.plist",
      extendInfo: {
        NSCameraUsageDescription: `${appIdentity.productName} uses the camera in meetings.`,
        NSMicrophoneUsageDescription: `${appIdentity.productName} uses the microphone in meetings.`,
      },
    },
    win: { target: [{ target: "nsis", arch: ["x64", "arm64"] }] },
    nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true },
  };
}

export default builderConfig(process.env);
