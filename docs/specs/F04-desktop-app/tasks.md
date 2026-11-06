---
feature: F04
title: Desktop app
status: in-progress
updated: 2026-11-03
---

# F04 Desktop app: Tasks (STEPS)

Small steps, done in order. Each step should be finishable and testable in one sitting.
Tick `[x]` when done and verified. Per D052, each task runs only its own tests plus typecheck and lint; the full run happens at `/spec-verify`. Desktop window tests run only while the owner is away (memory note).

- [ ] **T0: GitHub desktop check green** (D082/D077 follow-up). Add a small window manager to the CI desktop job and read why the F16 window tests fail on Linux. Fix TC-F15-56 and TC-F02-107 (also red on `main`). Check: the "Desktop app tests" check is green on this branch.
- [x] **T1: Spikes** (done 2026-11-04: D086, owner chose A; AC-37 deferred) (milestone: may need an owner decision).
  - A system-quiet helper (Mac Focus, Windows Do not disturb), vetted with `add-dependency`. It must work in the universal Mac build and on Windows x64 and arm64.
  - A hidden start at login on macOS 13+, with the 60-second fallback.
  - Write D086. If no helper is reliable, ask the owner about AC-37.
  
  Covers: AC-F04-08, 37, 60. Tests: TC-F04-80, 81, 82.
- [x] **T2: App identity and installers.** (done 2026-11-04: `electron-builder.config.ts` instead of `.yml`, so it can read `app-identity.ts`; the CI installer build and the throwaway-certificate check move to T17 with the Windows job)
  - `app-identity.ts` (name, app id, scheme, icons: D087).
  - `electron-builder.yml`: dmg universal, nsis x64/arm64, the `meetapp` protocol, unsigned until a certificate is set, and a throwaway-certificate signing check.
  - The install guide in `docs/getting-started.md`.
  
  Covers: AC-F04-01, 03, 60. Tests: TC-F04-01, 04, 05.
- [x] **T3: Close, Quit and one copy.** (done 2026-11-04; desktop tests in app-life.spec.ts run at spec-verify)
  - `app-life.ts` rules and the bridge: closing hides, the Dock icon stays.
  - Quit asks during a call; a shutdown or logout never asks.
  - One copy per profile.
  - A ring with the window hidden opens the call.
  
  Covers: AC-F04-02, 04, 06, 07. Tests: TC-F04-06, 07, 08, 09, 14, 15, 17, 18.
- [x] **T4: Menu-bar / tray icon and menu.** (done 2026-11-04; the menu is unit-tested; real tray clicks (TC-F04-12, 13) move to the T19 hand checks, because Playwright can't click a menu-bar menu; the status choice reaches the screens and is acted on in T8) Signed in and signed out; Mac template image; Windows left and right click. Covers: AC-F04-05. Tests: TC-F04-11, 12, 13.
- [x] **T5: Start at login.** (done 2026-11-04; development and tests use a stand-in login item in the profile folder, never the computer's real one) The login item rules, set once at first start, a hidden start, and the Settings → General switch. Covers: AC-F04-08, 09. Tests: TC-F04-19, 20, 21, 22.
- [x] **T6: Meeting links.** (done 2026-11-04; during a call the link waits for Meetings instead of a pre-join note: requirements updated)
  - Strict `links.ts`.
  - The link reaches the app through `second-instance`, `process.argv` or `open-url` (in `will-finish-launching`).
  - It is kept until sign-in, works during a call, and errors show F02's messages.
  - Copy link gives `meetapp://m/<code>`.
  
  Covers: AC-F04-10, 11, 12. Tests: TC-F04-24 to 31, 33, 34.
- [x] **T7: Status by hand (server).** Done 2026-11-04: migration 0010 (columns only), `PUT /api/v1/me/status` (20 a minute), the rule order (Offline stays Offline, as in Teams), a `status-expiry` BullMQ job plus the read-time check, Busy/DND/BRB on the live line and on `StatusDot`. There is no account export yet (privacy feature later); deleting an account removes the row with these columns.
  - The migration: `manual_status*` and `notify_*` columns only (`db-migration` skill).
  - `PUT /api/v1/me/status` and the presence rule order.
  - The expiry job, plus a check when status is read.
  - The new values on the live line, the rate limit, export and deletion.
  
  Covers: AC-F04-20, 21, 23. Tests: TC-F04-35, 36, 39, 40, 41, 42, 69, 92.
- [x] **T8: Status menu (screens).** Done 2026-11-04: canvas board "Desktop app (F04)" approved; `StatusMenu` molecule on a new slim top bar (`AppLayout.topBar`); `features/status` (time maths, `GET`/`PUT /api/v1/me/status`, now also with `chosen`); the tray's status picks last until changed. Desktop tests `status.spec.ts` (TC-43, 44) run at spec-verify.
  - `StatusMenu` molecule, drawn on the canvas first (D029).
  - The picture menu with durations, and the tray (until changed).
  - The duration maths in local time.
  - "In a call" unless the status is set by hand.
  
  Covers: AC-F04-20, 21, 23. Tests: TC-F04-37, 38, 43, 44.
- [x] **T9: Notification settings.** `GET` and `PUT /api/v1/me/notification-settings` with checks and limits. Settings → Notifications (five switches). Defaults apply when loading fails. Covers: AC-F04-36. Tests: TC-F04-65, 66, 67, 68. Done 2026-11-04: `modules/notifications`, Settings → Notifications (desktop only, like General), bell icon. TC-67 (each switch stops its card) is written with the cards, in T12.
- [x] **T10: Notice cards in main.** Done 2026-11-04: `notices.ts` (NoticeBoard: up to 3, 8 s with hover pause, ×, 10 a second, above F16's windows) and `notices-checks.ts` (Zod; zod added to apps/desktop at the workspace version); cards are a third view on F16's locked-down small page; `window.meetapp.notices.show/remove`; choices come back as `noticeChosen` on F16's line. Desktop tests `notices.spec.ts` (TC-50, 88, 90) run at spec-verify.
  - A third small-window kind in F16's controller: stacking with rings, never over the mini window, at most 3, 8 s with a pause on hover, and ×.
  - S17 lock-down.
  - The Zod card check and 10 a second.
  - Only main's own windows act.
  
  Covers: AC-F04-30. Tests: TC-F04-48, 49, 50, 88, 89, 90.
- [x] **T11: NoticeCard organism.** Done 2026-11-04 (drawn on the approved canvas board "Desktop app (F04)"); also drawn by the small window page. Screenshots are made at spec-verify. Message, mention, lobby and running variants, drawn on the canvas first, with stories and screenshots. Covers: AC-F04-30, 31, 33, 34. Tests: TC-F04-51.
- [x] **T12: Message and mention cards** (milestone: the owner can see cards). Done 2026-11-05: `features/notices` (rules, merging, chime, open on click, cards removed at sign-out), the server's time on `pong` (the app pings once on opening; two F14 tests now expect that ping), the first-close card via the `stillRunning` app command (`app-state.json` `firstCloseSeen`). Desktop tests `notices-chat.spec.ts` (TC-10, 54, 57, 67 switches, 95) run at spec-verify. Still to add there: TC-59 (mention in a muted chat, end to end; the rule is unit-tested in TC-58). TC-91 relies on the live line sending news only to members (F14 tests); TC-94: the notices code logs nothing.
  - `features/notices`: the skip rules, preview on or off, merging with one sound, mentions even in muted chats, and the 5-minute rule by the server's time.
  - The first-close "still running" card.
  - Sign-out stops cards.
  - No message text in logs.
  
  Covers: AC-F04-04, 31, 32, 33. Tests: TC-F04-10, 52 to 59, 91, 94, 95.
- [x] **T13: Quiet times.** Done 2026-11-05: `isQuiet` in the card rules reads the server's own status (the picture menu's query); a call still rings. TC-70 deferred with AC-37 (D086); the lobby part of TC-45 is checked with T14. Desktop tests TC-45, 46 in `notices-chat.spec.ts`. Do not disturb (the server's value) silences cards; calls still ring and missed calls are still noted. No system helper (D086). Covers: AC-F04-22. Tests: TC-F04-45, 46, 47, 70.
- [x] **T14: Lobby cards.** Done 2026-11-05: `lobby-cards.ts` started by the meeting screen (its lobby list is empty for those who can't admit); Admit uses F02's `decideLobby`, so the server checks the right (TC-63 rests on F02's admit tests); the "<n> people are waiting" card has View lobby only (Admit is optional on a lobby card in main's check). F16's missed-call tests pass unchanged (TC-64). Desktop tests `notices-lobby.spec.ts` (TC-62, TC-45 lobby part).
  - Only for a meeting the person is in and can admit in.
  - "Guest" mark, and one card from 3 people.
  - Admit uses F02's request (the server checks rights).
  - Missed calls unchanged.
  
  Covers: AC-F04-34, 35. Tests: TC-F04-60 to 64.
- [x] **T15: Reconnect.** Done 2026-11-05: `LiveLine.reconnectNow()` on `resume` (sent to the screens as an unlock), unlock and the page's `online` event; `maxWaitMs` 8 s in the desktop app. Old messages: the 5-minute rule (T12), and news missed while offline isn't sent again. Desktop tests `reconnect.spec.ts` (TC-73, 74, 75; network drops with Playwright's offline mode; TC-75 checks the catch-up rather than messages from 10 minutes ago, which the unit test TC-53 covers). `resume` and `online` reconnect at once, the retry wait is capped at 8 s, and there are no cards for old messages. Covers: AC-F04-38. Tests: TC-F04-73, 74, 75.
- [ ] **T16: Window, speed and calls in the background.**
  - `window-state.ts` and its file.
  - Start-up under 3 s.
  - A 10-minute call with the window hidden.
  - No secrets on disk.
  
  Covers: AC-F04-40, 41, 42. Tests: TC-F04-76, 77, 78, 79, 93.
- [ ] **T17: Updates off, About, and Windows.** electron-updater switched off; the About page; words and keys per system; desktop tests in the nightly Windows job; the installer build in CI and the throwaway-certificate signing check (TC-F04-01, 05, moved from T2). Covers: AC-F04-50, 60, 61. Tests: TC-F04-83, 84, 85, 86.
- [ ] **T18: Documentation.** Overview, security (cards under S17, links), the desktop and web READMEs, project structure, privacy (new columns, export), getting-started (install), the runbooks (tray, links, notifications), the decisions, and progress. Covers: all. Check: the docs-keeper finds nothing missing.
- [ ] **T19: Hand checks with the owner** (milestone). The installers and their warnings on Mac and Windows, the Windows quit path, start at login, a link from Mail, real Focus / Do not disturb, and the tray and cards on Windows. Covers: AC-F04-01, 06, 08, 09, 10, 37, 60, 61. Tests: TC-F04-02, 03, 12, 13, 16, 23, 32, 72, 87.
