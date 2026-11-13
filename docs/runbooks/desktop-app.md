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
- **"Unknown developer" warning when installing:** expected for a copy downloaded from elsewhere: until a certificate exists the Mac build has only an ad-hoc signature (D083, D089). A copy built on the same Mac opens without it. Mac: right-click the app, Open. Windows: More info, Run anyway.
- **Window opens in the middle of the screen:** its saved place (`window-state.json`) was on a screen that is gone, or the file was unreadable; it then opens centred on the main screen.

- **macOS asks for "MeetApp Safe Storage" in the keychain:** happens once after installing a newly built copy (each build's ad-hoc signature differs); enter the Mac login password and choose Always Allow. Accepted by the owner (T19); it goes away with real signing (D083).
- **The camera or microphone question comes again and again:** the copy was built without the ad-hoc signature and entitlements; rebuild with `pnpm desktop:dist` and reinstall.
- **An installed copy says "Can't reach MeetApp":** an installed app always talks to `http://127.0.0.1:3000`; run the backend there (`API_PORT=3000`, see apps/desktop/README.md).
