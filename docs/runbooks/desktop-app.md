# Desktop app: when something doesn't work (F04)

- **No MeetApp icon in the menu bar** (Windows: the taskbar's notification area): MeetApp isn't running. Open it from Applications (Start menu). Windows may hide tray icons behind the "^" arrow.
- **Closing the window vs Quit:** the red ✕ (⌘W) only hides the window; MeetApp keeps running, so calls ring and cards come. Quit (⌘Q, or Quit MeetApp in the menu-bar menu) ends it, and asks first during a call.
- **Start at login:** Settings → General → "Start MeetApp when I log in". It starts hidden in the menu bar. On macOS 13 and later the system's Login Items list shows MeetApp too (System Settings → General → Login Items). In development a stand-in file is used, so the computer's real list isn't touched.
- **A meeting link does nothing:** only `meetapp://m/<code>` links open Join a meeting; any other `meetapp://` address just brings MeetApp forward. During a call the link waits until you open Meetings (Teams' way comes with F17, D088). An installed app is needed for the system to know the link (`pnpm desktop:dist`, then install).
- **No notification cards:**
  - Settings → Notifications: are chat messages, mentions or lobby switched on?
  - Your status: Do not disturb silences cards (calls still ring).
  - The chat is open in a MeetApp window in front, or muted (mentions still show).
  - Messages older than 5 minutes (by the server's clock) never give a card, for example after sleep.
- **Only 3 cards:** at most 3 show at once; a fourth closes the oldest. Each goes after 8 seconds unless the pointer is on it.
- **"Unknown developer" warning when installing:** expected; the installers are unsigned until a certificate exists (D083). Mac: right-click the app, Open. Windows: More info, Run anyway.
- **Window opens in the middle of the screen:** its saved place (`window-state.json`) was on a screen that is gone, or the file was unreadable; it then opens centred on the main screen.
