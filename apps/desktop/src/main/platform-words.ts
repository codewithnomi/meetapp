// The words and keys each system uses (F04 AC-F04-60): where MeetApp waits when closed, the shortcut key,
// and the system's quiet mode. Free of Electron, so it can be tested.
export interface PlatformWords {
  /** Where the icon sits: the Mac menu bar, or the Windows taskbar's notification area. */
  where: "menuBar" | "tray";
  /** The key in shortcuts: ⌘ on a Mac, Ctrl on Windows. */
  modifier: "⌘" | "Ctrl";
  /** The system's quiet mode. */
  quiet: "Focus" | "Do not disturb";
}

export function platformWords(platform: NodeJS.Platform): PlatformWords {
  return platform === "darwin"
    ? { where: "menuBar", modifier: "⌘", quiet: "Focus" }
    : { where: "tray", modifier: "Ctrl", quiet: "Do not disturb" };
}
