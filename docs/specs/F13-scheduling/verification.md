---
feature: F13
title: Scheduling & calendar
verdict: FAIL
date: 2026-11-24
---

# F13 Scheduling & calendar: Verification Report (round 1)

Run under D092: unit + integration on the Mac, all checks, screenshots, and only the desktop tests near F13 (calendar, notification cards, Meetings page); the full desktop run happens on GitHub CI.

## Automated tests (whole project)
| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Unit + integration (vitest, 390 files) | 2,562 | 3 | 10 todo |
| Desktop (calendar, notices, notices-chat, notices-lobby, meetings-page) | 21 | 3 | 0 |
| Screenshots and gallery accessibility | 735 | 84 | 0 |
| Storybook build | ✅ | | |
| Backend container (`pnpm check:container`) | ✅ healthy, non-root, no secrets | | |

Typecheck: ✅ · Lint: ✅ · Format: ✅ · Architecture: ✅ after fixing a circular import found in review (`scheduling.ts` ↔ `meetings.ts`) · Unused code (knip): ❌ 16 unused exports, 14 unused types · Duplication, structure, licences: not reached (the check stops at knip).

Failures:
- `packages/db/src/scheduling.integration.test.ts` and `status.integration.test.ts`: the migration tests insert users on an older schema, but the fixture now writes `notify_invites` (migration 0013), and the F04 column list now has one more column.
- `apps/api/.../meeting-sweep.integration.test.ts` (TC-F02-102): `PATCH /meetings/:id/schedule` checks the body before who is asking, so an outsider gets 400 instead of 401/404.
- Desktop TC-F04-54, TC-F04-67 (notices-chat) and TC-F04-62 (notices-lobby): F04 notification cards; cause to be found (possibly the F13 card changes).
- Screenshots: the F13 components (DateTimeField, MeetingBlock, ReminderCard, RepeatPicker, CalendarGrid, MeetingDetailsPanel, ScheduleForm) and the icon sheet (new `repeat` icon) have no approved baseline yet; `molecules-statusmenu--open` (known follow-up) and the TC-F00-71 self-check also failed.

Coverage: the run stopped on failures before the summary; it is measured again on the next run.

## Acceptance criteria
29 PASS, AC-F13-12 and AC-F13-29 PASS but thinly tested, **AC-F13-04 PARTIAL**: the details panel has no Chat entry, while the AC (after D096) and TC-F13-24 still list it. The full table is in the ac-verifier's report; the evidence per AC is in tests.md.

## Security
Dependency audit: 15 (5 low, 10 moderate), no high or critical · Secrets scan: gitleaks ran in the commit hook (no leaks); the standalone `gitleaks` command isn't installed.
| Severity | Where | Problem | Fix |
|---|---|---|---|
| **High** | `reminders.service.ts:125`, `reminders.ts:71` | Any time-zone text is saved for 30 days and later breaks the minute job (reminders, organizer-left cancels, the 30-day privacy sweep all stop) | Check the zone is real in the contract; fall back to the meeting's zone; one bad person can't stop the job |
| Medium | `POST /reminders/dismiss` | No rate limit; any `originalStart` makes a new row | Limit per person; accept only real occurrences |
| Low | contracts `timeZone` | A bad zone on create gives 500 not 400 | Same zone check |
| Low | desktop `notices.ts` | Join is passed on even when the card has no Join | Check `card.join` like `card.admit` |
| Low | migration 0012 | Database doesn't force a row's workspace to match its meeting's | Composite foreign keys (follow-up) |

## Bugs found in review
- **High:** reminders ignore cancelled and moved single occurrences (`reminders.service.ts` `pendingOf` doesn't pass the changes).
- Medium: an occurrence moved into the shown range from outside it isn't shown; `dueFor` reads an all-day date in the viewer's zone; the all-day end is "midnight + 24 h" (wrong on clock-change days); a reminder card pushed out by a 4th card is lost for good (the page isn't told).
- Low: the outbox can send twice if saving the result fails; an invitee whose email can't be built stays "queued"; cancelled occurrences count toward the 500 limit.

## Quality targets (docs/product/quality-targets.md)
| Target | Measured | Result |
|---|---|---|
| Calendar changes seen within 5 s (AC-F13-09, 18) | Desktop TC-F13-75, 77 (5 s waits) | Met |

## UI review (Atomic Design, accessibility)
Must fix: `MonthView`, `MoreDialog` (and the other page-folder pieces that are pure UI) belong in packages/ui with stories and tests; MonthView's hand-written focus ring; Upcoming hides loading and error states; say that the keyboard way to create a meeting is New meeting. Should fix: ReminderCard isn't announced (`role="status"`), DateTimeField error not linked to the time box, Spinner says "Calendar" instead of loading, story gaps (CalendarGrid now-line/all-day/+N more, NoticeCard invite, etc.), links in notes swallow a trailing full stop.

## Code quality (complexity, duplication, patterns)
Must fix: the circular import (fixed during this run). Layering is sound. Several files are close to 300 lines (CalendarPage.tsx 292, scheduling.service.ts 279). The branch also carries F17's work (it started from F17's branch, PR #30), which the PR description must say.

## Documentation check
Not up to date: design.md (API paths, snooze body, job runs on the calls queue, 3-minute look-back, D094/D095 status), tests.md (5 file paths, 2 test ids), overview.md, security.md (S5 limits, outside emails), privacy-legal.md (new data and its keeping times), operations.md, project-structure.md, F02 design (`scheduled` kind), READMEs (api, ui, contracts, db, desktop), glossary (card kinds), progress.md. Three words differ between the spec and the app ("Tentative" vs "Maybe", "This occurrence / The whole series" vs "This meeting / The series", the failed-invites text): the app's words are used and the spec is aligned to them.

## Verdict
**FAIL.** A High security issue, a High bug, failing tests (3 quick, 3 desktop, the new screenshots), unused code, UI "must fix" items and out-of-date documents. Fix tasks T-fix-1 to T-fix-9 are in tasks.md.
