---
feature: F02
title: Meetings & calling
verdict: FAIL
date: 2026-10-16
---

# F02 Meetings & calling: Verification Report (first run)

## Automated tests (whole project)
Run on the owner's Mac, 2026-10-16 (`pnpm test`, Mac kept awake). The tests postponed by D052 were being written during this run and are not counted here.

| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Unit + integration (Vitest, 176 files) | 1532 | 0 | 10 todo (F00-era) |
| E2E desktop (Playwright Electron) | 29 | 9 | 0 |
| Component screenshots (`pnpm test:visual`) | not run yet (after the fixes) | | |
| Backend container (`pnpm check:container`) | not run yet (after the fixes) | | |

- **Desktop failures (9):** all from F00/F01 tests (appearance, profile, session, sign-in). They clicked a button named "Settings", and F02's new menu item "Workspace settings" also matches that name. The app is right; the tests now ask for the exact name (fixed on the branch, to re-run).
- **Coverage: FAIL.** Overall statements 81.5%, branches 73.2%, functions 78.0%, lines 84.3%. By folder: `apps/web/src/features/**` is at 57% lines, 49% branches and 48% functions; `apps/api/src/providers/**` is at 56% branches. The rule is ≥ 80%. Most meeting code in the app (the call, devices, joining) is tested only through the desktop windows, which don't count towards coverage.
- Typecheck ✅ · lint ✅ · architecture ✅ · unused code ✅ (no findings) · duplication 0.76% ✅.

## Acceptance criteria
Checked by the ac-verifier against code and tests (TC ids in `tests.md`).

| AC | Result | Evidence |
|---|---|---|
| 03–08, 14–19, 23, 24, 27, 41, 42, 48, 50–54 | PASS | backend integration and unit tests (meetings, lookups, join, lobby, controls, events, logs, sweeps), media.spec.ts |
| 01, 02, 09–11, 30–32, 40, 46 | PASS on the code; their screen tests (TC-13, 14, 18–21, 55, 56, 59–63, 83 member part, 91) were postponed by D052 and are being written | |
| 12, 47 | PASS (load test, T18, idle Mac); to re-run on an idle Mac | load.spec.ts |
| 13, 20, 21, 22, 25, 26, 28, 29, 33, 34, 36–39, 43–45, 49 | PARTIAL | code present; screen tests TC-24, 43–45, 49, 51, 52, 69, 71, 74, 75, 77, 79, 81, 88, 90, 98 missing or without their ID; AC-43 waits for the owner's look check (TC-87) |

## Security
- **Dependency audit (`pnpm audit --prod`):** 1 moderate (esbuild, reached only through better-auth → drizzle-kit; never run). Accepted in F01.
- **Secrets scan (gitleaks, Docker image):** 28 commits on the branch, no leaks.
- `pip-audit`: no Python code yet.

| Severity | Where | Problem | Fix |
|---|---|---|---|
| **High** | `calls/admission.ts` `roleOf`; `meetings.repository.ts` `findMeeting` | A co-organizer removed from the workspace keeps co-organizer powers in calls (skip lobby and lock, end, admit, remove) and can read the meeting record | Return only co-organizers who are still members; delete their co-organizer rows when they leave the workspace; integration test |
| Medium | `calls.routes.ts` `GET /attendances/:id` | No request limit; each call writes to the database and, once admitted, calls the call server | A generous per-ticket limit (e.g. 120 a minute); skip room creation and a new pass when nothing changed |
| Low | `calls.jobs.ts` `repairCall` | A non-UUID identity in a room stops the clean-up loop | Check the identity first; one try/catch per call |
| Low | `join.service.ts` `cleanGuestName` | Direction-changing and invisible characters are kept in guest names | Strip format characters (`\p{Cf}`), normalise |
| Low | `meetings.routes.ts` + idempotency | The repeat answer of "create meeting" keeps link and passcode in plain text in Redis for 10 minutes | Store only the meeting id; rebuild the answer |
| Low | `providers/livekit.ts` | The backend talks to the call server's admin API over plain http | An https setting for production |
| Low (accepted / later) | lookups, guest removal, `trustProxy` | One address can block ID+passcode joining for a known ID; a removed guest can come back with a new device key; proxy addresses before going online | Documented as known limits; `trustProxy` before going online |

## Quality targets (docs/product/quality-targets.md, D056)
| Target | Measured (T18, owner's MacBook) | Result |
|---|---|---|
| Sound delay, 100 people, under 250 ms | 63 ms (idle Mac) | ✅ (re-run) |
| Join under 3 s (95th percentile) | 1.2 s of 20 joins | ✅ (re-run) |
| Tiles show ≥ 90% of received frames | 14.5–15 of 15 (idle Mac); 1–15 on a busy Mac | ✅ idle only; re-run on an idle Mac |
| Memory, 25 people, under 700 MB | 430–650 MB (two runs) | ✅ |

## UI review (Atomic Design, accessibility)
Levels, imports, tokens and translations are correct. **Must fix:**
1. Meeting info panel: nothing shows while loading or when it fails.
2. Mic, camera and hand buttons change their name and also report "pressed"; screen readers hear contradictory words.
3. Closing a side panel loses keyboard focus; opening one doesn't move focus; Escape doesn't close it.
4. The whole call screen redraws every second (the clock), and the people list draws all 100 rows.

Should fix: speaker view can overflow very short windows; speaker view builds all tiles; Rejoin vanishes while pending; Share dialog can wait forever; unnamed devices show as "1"; co-organizer search has no "nobody found"; blank page without a visit; repeated announcements; no busy state on Admit all and Mute all.

## Code quality (complexity, duplication, patterns)
No "must fix" (score 8/10). Layering clean, no architecture violations, duplication 0.76%. Should fix: silent `.catch(() => undefined)` around device changes; a cast in `join.service.ts` `entryFor`; repeated story set-ups.

## Documentation check
Must fix: design.md (created files, `0004_lobby_reasons`, column names, `left_reason` values, indexes, error codes, the load-test call server, D054/D055 status); tasks.md and tests.md error-code names; D055 and frontend.md (`@livekit/components-react` was not added); infrastructure.md (load-test call server); quality-targets.md (the 90% rule); privacy-legal.md (ticket fingerprint kept with the record); project-structure.md; docs/README.md runbook list; progress.md session log; the READMEs of api, desktop, web, ui, contracts and db.

## Bugs found
Medium:
1. A call that can't connect at all leaves an empty screen (the "failed" state is never shown).
2. A closed connection's result can overwrite the new one's state (quick restarts, Rejoin).
3. A person let in who never connects keeps a place in the call forever (counts toward 100).
4. Rejoin is used up before the join is decided, so a failed Rejoin can't be retried.
5. Pressing Enter twice on the pre-join joins twice.

Low: a second reaction disappears early; the lobby check keeps asking every 2 s after an error; the call-server report is marked handled before it is applied; a device with an empty name is treated as unplugged.

## Verdict
**FAIL.** The meeting features are built, and every backend and security rule but one is met, but F02 can't be marked done yet:
- one serious security gap (a removed co-organizer keeps their powers);
- 5 real bugs and 4 screen problems to fix;
- test coverage of the app's meeting code under 80%, and the screen tests postponed by D052 still being written;
- the documents to bring up to date;
- after the fixes: the whole suite, the screenshots, the container check, the load test on an idle Mac and the owner's look check.

Each problem is a fix task (T-fix-1 … T-fix-8) in tasks.md.
