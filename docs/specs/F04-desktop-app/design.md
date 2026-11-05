---
feature: F04
title: Desktop app
status: approved
updated: 2026-11-03
---

# F04 Desktop app: Design (HOW)

## Summary (plain English)
MeetApp gets real installers, made with **electron-builder**, a common free tool: a `.dmg` for Mac and an `.exe` for Windows. They are unsigned for now, but the signing settings are already in place, waiting for a certificate.

Closing the window doesn't end MeetApp. The window is only hidden, and a small icon stays in the menu bar (Windows: the taskbar's notification area). Everything keeps running behind it: the live line for messages, ringing, and the F16 call windows. **Quit** really stops it.

At login, MeetApp starts hidden. `meetapp://m/<code>` links open the meeting's pre-join screen.

Notifications for messages, mentions and the lobby are small MeetApp cards in the corner. They are built the same way as F16's ring window and stack with it.

People can set their status by hand. The server keeps it, so every device and colleague sees the same status.

The window remembers its size and place. A self-updater from GitHub releases is built in but switched off.

**One thing to check first (T1):** Electron can't tell whether the Mac's Focus or Windows' Do not disturb is on. T1 tests a small free helper for that. If none works reliably, AC-37 needs the owner's decision before building it (see Risks).

## 1. What gets created
**Desktop (apps/desktop):**
- `electron-builder.config.ts`: the Mac `dmg` (universal) and Windows `nsis` (x64, arm64) installers; app id `app.meetapp.desktop`; the `meetapp` link scheme (`protocols`); `mac.identity: null` (unsigned) until `CSC_LINK` is set; `publish: github` for updates (AC-01, 03, 10, 50).
- `src/main/app-life.ts` (rules, no Electron): what close, Quit, a second start, a link and login start mean. `app-life-bridge.ts` connects these rules to Electron: `requestSingleInstanceLock`, `second-instance`, `open-url`, `before-quit`, `window-all-closed`, `setLoginItemSettings` (AC-02, 04, 06, 08–10).
- `src/main/tray.ts`: the menu-bar or tray icon and its menu: Open MeetApp, status, Settings, Quit; Sign in when signed out (AC-05). Mac: a template image (16 and 32 px), menu on click. Windows: left-click opens the window, right-click the menu (as Teams).
- `src/main/links.ts` (no Electron): reads `meetapp://m/<code>` strictly. Anything else is ignored (AC-10, 11).
- `src/main/window-state.ts` (no Electron) and its file `userData/window-state.json`: the size and place, checked against the screens (AC-40).
- `src/main/notices*.ts`: corner cards as a third small-window kind ("notice") in F16's controller. They have the same locked-down session, CSP and preload as the ring window, stack with rings, and never cover the mini window (AC-30).
- System quiet (AC-37) is deferred until signing (D086); no `system-quiet.ts`.
- `src/main/updates.ts`: electron-updater, switched off by a setting (AC-50).
- `src/preload`: `window.meetapp.app` gains `onOpenMeeting(listener)`, `setStatusFromTray`, `firstCloseSeen`, `loginItem.get/set`, `version`. `window.meetapp.notices.show(card)` is checked by main.

**Screens (apps/web):**
- `features/notices/`: decides from the live line (`news`), the meeting's lobby list and the settings whether a card shows (AC-31–38). It runs in the main window, hidden or not, and sends the card to main.
- `features/status/`: the status menu (picture menu and tray) and "for how long" (AC-20, 21).
- Pages:
  - Settings → **General**: start at login (AC-09).
  - Settings → **Notifications**: the five switches (AC-36).
  - Settings → **About**: version and "Updates are turned off" (AC-50).
  - Opening a meeting link goes to F02's pre-join (AC-10).

**UI (packages/ui):** `NoticeCard` organism (message, mention, lobby, "still running"). `StatusMenu` molecule. Stories, tests and screenshots, drawn on the canvas (D029) before they are built.

**Backend (apps/api):**
- `PUT /api/v1/me/status`: set a status for a time, or reset it.
- `GET` and `PUT /api/v1/me/notification-settings`.
- The presence logic of F14 (3.8) first checks a status set by hand that hasn't run out.

**The name "MeetApp" is temporary** (owner, 2026-11-03). The app's name, app id (`app.meetapp.desktop`), link scheme (`meetapp://`), icons and installer names are kept in one place (`apps/desktop/app-identity.ts`, read by `electron-builder.config.ts` and the app; a TypeScript config because a YAML file cannot import it), so the final name means changing one file and the icons.

## 2. Screens / user flow
1. **Install.** Open the `.dmg`, drag MeetApp to Applications, and open it. The Mac warns that the app is unsigned; the getting-started guide shows how to allow it once. On Windows, "Windows protected your PC" appears: More info, then Run anyway.
2. **Close the window.** It hides. The first time, a corner card says it is still running. The menu-bar icon stays.
3. **Menu-bar icon.** Open MeetApp, a status submenu, Settings, Quit MeetApp.
4. **Quit during a call.** "Quit MeetApp? You'll leave the call." with Quit and Cancel.
5. **Click a link** in Mail or a calendar. MeetApp opens at the pre-join screen of that meeting.
6. **Picture menu (top right) → Status.** Available, Busy, Do not disturb, Be right back, Appear away, then "for how long"; Reset status.
7. **A message arrives** while that chat isn't in front. A card shows the picture, sender, chat and up to 100 characters. Click to open the chat; it goes away after 8 s.
8. **Settings → Notifications.** Chat messages, Mentions, Lobby, Sound, Show message preview.

## 3. How it works
### 3.1 Close, hide and quit (AC-04, 06, 07)
- Closing a window hides it (the `close` event is prevented), so its page keeps running: the live line, F16 reports and notices.
- Every main window's `close` is prevented and the window hidden, unless `quitting` is true. The Mac Dock icon stays, as in Teams; clicking it or Open MeetApp shows the window again.
- Quit sets `quitting = true`. If the F16 controller reports a call, main first asks with a native dialog. A real quit closes the windows and calls `app.quit()`.
- When the computer shuts down or logs out (`powerMonitor` `shutdown` on Mac; `session-end` / `query-session-end` on Windows), MeetApp quits without asking and leaves a call cleanly, so it never holds up the shutdown.
- A ring while the window is hidden counts as "not in front", so F16's ring window shows. Accepting brings the window back (AC-07).

### 3.2 One copy, links and login start (AC-02, 08–11)
- In the packaged app, `requestSingleInstanceLock()` applies per profile folder, so development and test windows (each with their own profile) still run side by side.
- A second start, or a link on Windows while MeetApp runs, arrives as `second-instance`. A link that starts MeetApp on Windows is read from `process.argv` at first start. On Mac, `open-url` is listened for in `will-finish-launching`, so a link that starts the app isn't missed.
- `links.ts` accepts only `meetapp://m/<code>`, with a code of the F02 shape. Anything else only brings MeetApp to the front.
- Login item:
  - `setLoginItemSettings({ openAtLogin, args: ["--hidden"] })` on Windows.
  - On Mac, `openAtLogin`. With the macOS 13+ login items, `args` and `wasOpenedAtLogin` may not work. T1 checks it. The fallback is that a start with no link and no window wanted, within 60 s after the person logged in, starts hidden. The login item only registers from the installed app in Applications.
  - It is turned on at the first start after install (a flag file). An update keeps the stored choice.
- The screens listen through `window.meetapp.app.onOpenMeeting` (main keeps the link until they do). The link goes into F02's Join a meeting form and is looked up as if typed, so F02's messages show and nothing is joined. During a call or in a lobby the screen stays and the link waits for Meetings. The shared pieces live in `@meetapp/contracts/app-links` (a small entry, so the preload stays small).
- Copy link in F02 gives `meetapp://m/<code>` while there is no website. F02's wording ("the link") still fits; only the link's form changes (AC-12; web unit test). When we go online, the https link opens a page with "Open in MeetApp" (later).

### 3.3 Status by hand (AC-20–23)
- Users get `manual_status` (`available`, `busy`, `dnd`, `brb`, `away`, or null = automatic) and `manual_status_until` (a time, or null for "until changed"). A hand-set Available stays Available when idle (as Teams).
- `STATUSES` gains `busy`, `dnd` and `brb`. The F14 rule becomes:
  1. a hand-set Busy, Do not disturb, Be right back or Away that hasn't run out;
  2. otherwise "In a call" during a call (AC-23);
  3. otherwise a hand-set Available that hasn't run out;
  4. otherwise the automatic status.

  Someone with no open MeetApp (Offline) shows Offline whatever they set, as in Teams; the hand-set status shows again when they come back, if it hasn't run out (added during T7).
- The app works out `until` in the person's own time zone (Today = 23:59:59 local; This week = Sunday 23:59:59 local) and sends it as an ISO time. The server refuses an `until` in the past or more than 8 days ahead (400). The tray's status menu sets "until changed" only; the picture menu offers the durations.
- F16 requirements' note on Do not disturb is updated with AC-F04-22 (done with the requirements).
- A BullMQ delayed job clears the status when it runs out and announces the change on the live line. Others see it within 5 s, as F14 does.
- "Appear away" is `away`. "Reset status" clears both columns.

### 3.4 Notifications (AC-30–38)
- **In the main window** (`features/notices`), for each live-line `news` message:
  - Skip it if any of these is true:
    - it is the person's own message;
    - that chat is the one shown in a window in front (F16 already knows focus);
    - the chat is muted, unless the message mentions the person;
    - the setting for that kind is off;
    - the status is Do not disturb;
    - system quiet is on;
    - the message is more than 5 minutes old by the server's time (the live line's clock offset, not the computer's clock: the server puts its time on each `pong`, and the app pings once as the line opens; added during T12).
  - A mention gives one "mentioned you" card, never a second plain one (AC-33).
  - Cards for the same chat are merged while showing: "<n> new messages", and the sound plays once (AC-32).
  - With preview off, the card says "New message" (AC-31).
- **Lobby:** as in Teams, only for a meeting the person is in (joined in a window, which may be hidden or behind other apps) where they can admit. That meeting's page already gets the lobby list (F02), so nothing new is polled. Each new waiting person gives a card with Admit and View lobby. A guest shows the name they typed, marked "Guest". With 3 or more waiting, one card says "<n> people are waiting" (AC-34). Admit calls F02's existing admit request, so the server checks the right as usual.
- **Main** places the cards with F16's layout:
  - the bottom-right corner, stacked with the ring windows, never over the mini window;
  - at most 3 cards; a fourth closes the oldest;
  - 8 s each, paused while the pointer is over a card;
  - the × closes a card.
  
  A click is sent back to the main window that sent the card (open chat, View lobby, Admit).
- **Main checks every card** with a Zod schema: the kind is message, mention, lobby or running; the text is cut to 100 characters and names to 80; photos follow F16's rules (PNG, JPEG or WebP, about 400 KB at most); at most 10 cards a second from one window, the rest dropped. The preload list in apps/desktop gains `notices` and the new `app` calls (a design change, as F16 did).
- Sound: one short chime per card, from the app's own files, if Sound is on.
- Missed calls are left as they are (F16 Mac notification, D080; AC-35).

### 3.5 Window state, speed and updates (AC-40–42, 50)
- `window-state.json` keeps `{x, y, width, height, maximized, displayId}`. It is written 500 ms after a move or resize stops, and checked when read, as F16 does. If the screen is gone, the window opens centred on the main screen.
- **Start-up under 3 s:** from the process start (`process.getCreationTime`) to the chat list's first paint, signed in, in a desktop test on the owner's Mac; a hidden login start doesn't count (AC-41).
- **Calls in the background:** a hidden window is "not in front", so F16 keeps full speed during a call. Tested as F16 did, with the window hidden (AC-42).
- **Updates:** `electron-updater` with the GitHub provider. `updates.enabled` is false (a build setting), so it never checks. Settings → About shows the version (AC-50).

### 3.6 After sleep (AC-38)
`powerMonitor` `resume` and the page's `online` event make the live line reconnect at once. While the desktop app runs, F14's wait between tries is capped at 8 s, so AC-38's 10 s holds after a network drop too. F14 already catches up on unread messages. The 5-minute rule keeps old messages from popping up.

## 4. Data stored
- **Server, `users`:**
  - `manual_status` (text, null)
  - `manual_status_until` (timestamp, null)
  - `notify_messages`, `notify_mentions`, `notify_lobby`, `notify_sound`, `notify_preview` (booleans, default true)
  
  One migration, adding columns only (db-migration skill). They are part of the account's export and are removed with the account (privacy-legal.md).
- **This computer (userData):**
  - `window-state.json`
  - `app-state.json` (first close seen, login item set once)
  - F16's `call-windows.json` (unchanged)
  
  Nothing personal is stored.

## 5. Backend endpoints / messages
- `PUT /api/v1/me/status`
  - Body: `{ status: "available"|"busy"|"dnd"|"brb"|"away"|null, until: ISO time|null }`
  - Answers 200 with `{ status, chosen, until }`: the effective status, the hand-set one (or null) and its end. A wrong value or `until` gives 400.
  - `GET /api/v1/me/status` gives the same, so the picture menu shows it (added during T8).
  - Being rate-limited (20 a minute) gives 429.
- `GET /api/v1/me/notification-settings` returns the five switches. `PUT` saves them (partial update allowed; unknown keys give 400; 20 a minute).
- Live line: `status` messages can carry the new values. Older apps ignore values they don't know.

## 6. Edge cases & errors
- **The link arrives before sign-in.** It is kept and opened once the person has signed in, or the guest join screen opens (AC-10).
- **A link while in a call.** F02's pre-join warns that joining leaves the current call.
- **No tray area** (some Linux setups): Linux is out of scope. The app still runs with the window.
- **The status job is lost** (Redis restart). The presence logic also checks `manual_status_until` when it reads, so an expired status is never shown.
- **The notification settings can't be loaded.** The defaults apply (all on), and the app retries.
- **Many messages at once** (after sleep): the 5-minute rule, plus at most 3 cards.
- **The window is closed while a notice shows.** Cards still work: the page is only hidden.
- **The person signs out.** Notices stop, the cards close, and the tray shows Sign in.

## 7. Security & privacy
- The S17 small-window rules apply to the notice cards: their own session, CSP and preload, and only main's own windows may act.
- A card shows only what the person may already see in that chat (F14 rules), with the preview limited to 100 characters.
- Links: strict reading. A link never joins anything by itself; the server checks the code as usual (S5 limits).
- The status endpoints act only on the signed-in person and are rate-limited.
- Updates stay off. When they are switched on, S18 (signed updates) applies.
- Login start stores nothing new. The sign-in key stays in the keychain.

## 8. Cost impact
None. electron-builder and electron-updater are free and open source. Signing stays off (D017). GitHub Releases are free for this repository.

## 9. Risks
- **System quiet (AC-37).** macOS has no public way to read Focus state, and Windows offers `SHQueryUserNotificationState` only through a native helper.
  - T1 tries a small, maintained helper package (vetted with `add-dependency`) on the owner's Mac and on Windows; it must work in the universal Mac build (arm64 and x64) and both Windows builds (x64 and arm64).
  - If it isn't reliable, the owner decides: drop AC-37 and rely on MeetApp's own Do not disturb, or use the Mac's notification centre once the app is signed, which respects Focus by itself.
- **Login start on macOS 13+:** the hidden start is checked in T1.

## 10. Test approach
- **Unit:** `app-life`, `links`, `window-state`, the notices rules (`features/notices`), the status rule, and the card layout in F16's controller.
- **Integration (API):** status set, expiry and reset with announcements; notification settings; the rate limit; the migration.
- **Desktop e2e (real windows):**
  - close hides and keeps ringing;
  - Quit asks during a call;
  - second start;
  - link via `second-instance` and via `open-url` (sent by the test);
  - window state after a restart;
  - message, mention, lobby and merged cards;
  - Do not disturb silences cards;
  - catch-up after sleep (simulated `resume`) and after a network drop (within 10 s);
  - a link that starts MeetApp (argv) and `open-url` before ready;
  - start-up time;
  - a call with the window hidden: 10 minutes, no sound gap over 500 ms, the other side's video frames keep coming (AC-42).
- **Visual:** NoticeCard and StatusMenu stories.
- **By hand (AC-61):** installers and their warnings on Mac and Windows, start at login, a link from Mail, the tray on Windows.

| AC | How |
|---|---|
| 01 | by hand (installers); CI builds both |
| 02 | e2e second start |
| 03 | CI build with a throwaway certificate |
| 04–07 | e2e |
| 08–09 | unit (login item calls), by hand at login |
| 10–12 | unit (links), e2e (link events), by hand (Mail) |
| 20–23 | integration + e2e |
| 30–34 | unit + e2e |
| 35 | F16 tests unchanged |
| 36 | integration + e2e |
| 37 | deferred (D086) |
| 38 | e2e (simulated resume) |
| 40–42 | unit + e2e (start-up time, hidden call) |
| 50 | unit (updater off), e2e About |
| 60–61 | the GitHub Windows run (nightly, to save free minutes) + hand checks |

## Decisions made here
- **D084 (proposed):** electron-builder for the installers and electron-updater (off) for updates.
- **D085 (proposed):** closing hides the window, and notifications are MeetApp corner cards built on F16's small windows.
- **D086 (proposed, after T1):** how system quiet is read, or the owner's choice if it can't be.
