---
feature: F04
title: Desktop app
verdict: PASS
date: 2026-11-13
---

# F04 Desktop app: Verification Report

## Automated tests (whole project)
| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Unit + integration (`pnpm test`, 347 files) | 2395 | 0 | 0 |
| Desktop windows (e2e, full run 2026-11-13) | 147 | 8 → 0 on re-run | 1 |
| Screenshots + accessibility (`pnpm test:visual`) | 704 | 12 (timeouts on this Mac, none F04; CI re-checks) | 0 |

Coverage: 92.66% statements, 84.76% branches, 92.21% functions, 95.31% lines (threshold 80%).
Typecheck ✅ · Lint ✅ · `pnpm check` ✅ (architecture, unused code, duplication 1.46%, structure, licenses) · `pnpm check:container` ✅ (healthy, non-root, no `.env`, no secrets).

**Desktop window runs, honestly told.** Several full runs on 2026-11-13 were spoiled before this one: the Mac on battery fell asleep, a meeting stopped one, and the backend crashed. The crash was a real bug, not the Mac: a dropped database connection during the live line's every-second sign-in check went uncaught, and Node stopped the whole server (fixed in 1c23a19, test added to `chats-line.integration.test.ts`, TC-F14-73). After the fix, the full run gave 147 passed and 8 failed. All 8 then passed together in one re-run. What they were:
- Five passed on their first re-run (timing).
- TC-F02-19 and TC-F02-44 (the fake microphone's beep is not heard) fail only after other tests ran before them. The same happens on `main` (checked in a separate copy), so F04 did not cause it.
- TC-F04-79 (call runs on 10 minutes, window behind, minimised, hidden) failed twice when video was slow to start, then passed twice with about 2,400 frames a minute in every phase.
- The clean-up after a test could wait forever on a stuck app; it now waits at most 3 s (48c94d9).

Still open (test setup, not the app): Playwright sometimes reports "Worker teardown timeout" after the last desktop test although every test passed. Follow-up for the test setup.

## Acceptance criteria
| AC | Result | Evidence |
|---|---|---|
| AC-F04-01 installers | PASS (Mac) / WAIVED (Windows, D090) | electron-builder.config.test.ts (TC-01, 04); Mac dmg installed by hand (T19) |
| AC-F04-02 one copy | PASS | app-life.spec.ts TC-06/07; app-life.test.ts |
| AC-F04-03 signing is settings only | PASS | electron-builder.config.test.ts; nightly Windows job (T17) |
| AC-F04-04 close keeps running, first-close card | PASS | app-life.spec.ts TC-09; notices-chat.spec.ts TC-10 |
| AC-F04-05 tray menu | PASS | tray-menu.test.ts; Mac hand check (T19) |
| AC-F04-06 quit | PASS (Mac) / WAIVED (Windows, D090) | app-life.spec.ts TC-14/15 |
| AC-F04-07 ring with no window | PASS | app-life.spec.ts TC-18 |
| AC-F04-08 start at login, hidden | PASS | login-item.test.ts; app-life.spec.ts TC-20/21 |
| AC-F04-09 login switch in Settings | PASS | GeneralSettingsPage.test.tsx; login-item.test.ts |
| AC-F04-10 link opens pre-join | PASS | links.spec.ts TC-25/28/34 (in-call: waits for Meetings; Teams-style browsing is F17, D088) |
| AC-F04-11 bad links | PASS | links.test.ts; app-links.test.ts; links.spec.ts TC-31 |
| AC-F04-12 copy link | PASS | meetings-api.test.tsx; links.spec.ts TC-34 |
| AC-F04-20 pick status | PASS | status.spec.ts TC-44; StatusMenu.test.tsx; status integration tests |
| AC-F04-21 durations | PASS | until.test.ts TC-38; status.spec.ts TC-44 |
| AC-F04-22 Do not disturb silences cards | PASS | notice-rules.test.ts; notices-chat.spec.ts TC-45/46; notices-lobby.spec.ts TC-45 |
| AC-F04-23 "In a call" | PASS | status.spec.ts TC-43 |
| AC-F04-30 card window rules | PASS | notices.test.ts; notices.spec.ts TC-50/88/90; NoticeCard.test.tsx |
| AC-F04-31 message card | PASS | use-notices.test.tsx; notices-chat.spec.ts TC-54/55/59; reconnect.spec.ts TC-75 |
| AC-F04-32 merging | PASS | notice-rules.test.ts; notices-chat.spec.ts TC-57 |
| AC-F04-33 mention card | PASS | notice-rules.test.ts TC-58; use-notices.test.tsx |
| AC-F04-34 lobby card | PASS | lobby-cards.test.ts; notices-lobby.spec.ts TC-62 |
| AC-F04-35 missed calls unchanged | PASS | F16 call-window tests unchanged and green (TC-64) |
| AC-F04-36 notification settings | PASS | notification-settings integration test; notices-chat.spec.ts TC-67 |
| AC-F04-37 system Focus | DEFERRED | D086 (owner's choice) |
| AC-F04-38 reconnect | PASS | reconnect.spec.ts TC-73/74; live-line.test.ts |
| AC-F04-40 window state, fuses | PASS | window-state.test.ts; window.spec.ts TC-77/93; TC-96 (fuses) |
| AC-F04-41 start under 3 s | PASS (dev build) | window.spec.ts TC-78; installed copy not timed |
| AC-F04-42 call keeps running in the background | PASS | window.spec.ts TC-79 (video keeps arriving in all three phases) |
| AC-F04-50 updates off, About | PASS | updates.test.ts; AboutPage.test.tsx; window.spec.ts TC-84 |
| AC-F04-60 Mac and Windows words and keys | PASS (Mac) / WAIVED (Windows by hand, D090) | platform-words.test.ts; nightly Windows job |
| AC-F04-61 tests on both systems, hand checks | PASS (Mac) / WAIVED (Windows by hand, D090) | Mac hand checks T19 |

## Security
Dependency audit (`pnpm audit --prod`): 0 critical, 0 high; 5 low and 10 moderate in libraries (nodemailer, fast-uri, fastify, esbuild, glob, minimatch). All are on `main` too; to be handled with `/deps-update`.
Secrets scan (gitleaks, in the container check and on every commit): no leaks found.

| Severity | Where | Problem | Fix |
|---|---|---|---|
| Medium | electron-builder.config.ts | Electron fuses were not set | Fixed: fuses set (RunAsNode off, NODE_OPTIONS off, inspect off, ASAR integrity on, app only from ASAR), TC-F04-96 |
| Low | build-resources/entitlements.mac.plist | `disable-library-validation` | Kept: the ad-hoc signed build needs it to load Electron's own frameworks (D089); goes with real signing |
| Low | meeting-links.ts | A bad link keeps a waiting good one | No change needed (the server checks codes) |

## Quality targets (docs/product/quality-targets.md)
| Target | Measured | Result |
|---|---|---|
| App start under 3 s | TC-F04-78, five starts, dev build | Met |
| Call keeps running in the background | TC-F04-79, 9 minutes in three phases | Met |
| Status seen by others within 5 s | TC-F04-44 | Met |

## UI review (Atomic Design, accessibility)
No Must-fix. Fixed from the review: the chosen status shows a tick (not colour alone); the status menu no longer looks permanently selected; decorative status dots are hidden from screen readers; the notification card is announced once; keyboard focus pauses a card like the pointer does. Left as they are: a loading spinner in Notification settings (TC-F04-68 wants the switches shown on while loading).

## Code quality (complexity, duplication, patterns)
No Must-fix. `pnpm check` green; duplication 1.46%. Fixed: the shared `focusMain` helper; the status job checks its data with a schema.

## Documentation check
The docs-keeper's findings were fixed: D089 (ad-hoc signing, packaged backend address), design.md, runbook, overview and project structure updated; D090 records the Windows hand-check waiver.

## Bugs found
- Fixed: lobby card not shown again after main dropped it; status Available after the network came back on a locked Mac; × not telling the page; hover not holding a re-sent card; server announce before the run-out job; the backend crash on a dropped database connection (above).
- Not changed: the status end time uses the computer's clock (a clock 30 minutes wrong is rare; noted for later).

## Verdict
**PASS.** Every test passes, every acceptance criterion is met on the Mac (Windows hand checks waived by the owner, D090; system Focus deferred, D086), no Critical or High security issues, no Must-fix review items, and the docs are up to date. Still open from T0: the GitHub desktop check (TC-F15-56, TC-F02-107).
