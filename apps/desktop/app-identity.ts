// The app's name and identity in one place (D087: "MeetApp" is a working name). The installers
// (electron-builder.config.ts) and the app read it, so a new name means changing this file and the icons.
export const appIdentity = {
  /** Shown in the Dock, the Start menu, the window title and the installers. */
  productName: "MeetApp",
  /** The system's id for the app (Mac bundle id, Windows app user model id). */
  appId: "app.meetapp.desktop",
  /** Meeting links: meetapp://m/<code> (F04 AC-10). */
  linkScheme: "meetapp",
  /** One 1024×1024 PNG; electron-builder makes the Mac .icns and the Windows .ico from it. */
  icon: "build-resources/icon.png",
} as const;
