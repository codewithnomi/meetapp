---
feature: F13
title: Scheduling & calendar
status: in-progress
updated: 2026-11-20
---

# F13 Scheduling & calendar: Tasks (STEPS)

Small steps, done in order. Each step should be finishable and testable in one sitting.
Tick `[x]` when done and verified. Per D052/D092, each task runs only its own tests plus typecheck and lint;
small UI tests and pictures run at `/spec-verify`, with only `calendar.spec.ts` of the desktop tests on the Mac.

- [x] **T1: Database.** Migration (via `db-migration`): `scheduled` added to `meeting_kind` in its own step; `meeting_schedules`, `meeting_occurrence_changes`, `meeting_invitees`, `meeting_invitee_answers`, `reminder_dismissals` (id, timestamps, indexed workspace_id, 250-invitee trigger); F02 code that switches on `kind` updated; expiry for scheduled meetings (D093). Covers: AC-F13-13. Tests: TC-F13-05, plus `packages/db/src/scheduling.integration.test.ts` (migration on F02 data, invitee rules, 250 limit). TC-F13-64 and 65 need a scheduled meeting made by the API, so they run with T4.
- [x] **T2: Repeat rules.** Vet and add `rrule-temporal` (D094) (`add-dependency`); expansion in the meeting's zone, month ends, summer time, 1-year and 500 caps, occurrence changes applied. Covers: AC-F13-11, 02. Tests: TC-F13-01, 02, 03, 04.
- [x] **T3: Contracts and rules.** Zod schemas in `packages/contracts` (form limits, repeat, answers, scopes); permissions per role (`scheduling.permissions.ts`). Covers: AC-F13-10, 20, 26. Tests: TC-F13-10, 11, 12.
- [x] **T4: Create and read.** Scheduling module: create (meeting + schedule + invitees in one transaction, external emails encrypted), the calendar range endpoint, details endpoint; workspace scoping; 50/hour limit; Meet now and links stay out of the calendar. Covers: AC-F13-09, 10, 12, 13, 14, 26, 27. Tests: TC-F13-47, 48, 49, 58, 59, 60, 64, 65, 66, 67 (TC-F13-47's email and live news parts with T5/T6; TC-F13-57's change, cancel and answer parts with T6).
- [x] **T5: Calendar files and emails.** Vet and add `ical-generator`; .ics builder (REQUEST/CANCEL, SEQUENCE, RRULE, EXDATE, RECURRENCE-ID, escaping); invite/update/cancel templates with footer; email attachments in the provider; outbox result callback and `email_status`; jobs hold only the invitee id; atomic 1,000/hour reserve; Retry. Covers: AC-F13-15, 27, 28, 30, 31. Tests: TC-F13-06, 07, 08, 09, 50, 51, 52, 71, 72, 73.
- [x] **T6: Answer, update, cancel.** Answer (series or one occurrence), update with this/series (series time change resets answers), cancel with message; 403/404; live line `calendar` and `invited` events; (meeting chat for invitees before the meeting moved out, D096). Covers: AC-F13-04, 16, 17, 18, 19, 20. Tests: TC-F13-53, 54, 55, 56, 57.
- [x] **T7: Reminders and clean-up jobs.** Reminder job (15 min, start, all-day 09:00 in the person's zone, snooze, once per person, dismiss across devices), due reminders on start; organizer/invitee leaving the workspace; 30-day privacy sweep. Covers: AC-F13-21, 22, 29, 30. Tests: TC-F13-13, 14, 15, 62, 63, 69, 70, 74.
- [x] **T8 (milestone): Design system first (D029).** Add CalendarGrid, MeetingBlock, DateTimeField, RepeatPicker, ScheduleForm, MeetingDetailsPanel and ReminderCard to the design system and a Calendar screen to the screen designs, Teams-style; the owner approves the look before T9.
- [x] **T9: UI pieces.** The approved pieces in `packages/ui` with stories (overlap layout, block states, spoken text, now line, time format, keyboard). Covers: AC-F13-01, 02, 06, 24, 25. Tests: TC-F13-16, 17, 21, 23, 41, 46.
- [x] **T10: Calendar screen.** Side-menu item, `CalendarPage` (views, Today, back/forward, only the open workspace, empty hint, Join window, details panel, offline), live updates. Covers: AC-F13-01, 03, 04, 05, 32. Tests: TC-F13-18, 19, 20, 22, 24, 25, 40, 44, 45.
- [x] **T11: Form, answers, edit and cancel screens.** New/edit form (drag to fill, all day, invitees with any email, repeat picker, field errors, wait time), answer buttons, this/series question, cancel dialog, failed-invites notice. Covers: AC-F13-07, 08, 10, 11, 14, 16, 18, 19, 20, 31. Tests: TC-F13-26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 39.
- [x] **T12: Reminder cards, invite notifications, Meetings "Upcoming".** Corner cards with Join/Snooze/Dismiss, the "Meeting invites" setting (F04 settings spec updated), Do not disturb; Upcoming card on Meetings. Covers: AC-F13-17, 21, 23. Tests: TC-F13-36, 37, 38, 68.
- [x] **T13: Translations and docs.** Every text in `en.json`, region formats; runbook, READMEs, glossary, F02/F04 spec notes. Covers: AC-F13-25. Tests: TC-F13-42, 43.
- [x] **T14: Desktop tests.** `tests/e2e/desktop/calendar.spec.ts`. Covers: the user journeys. Tests: TC-F13-75, 76, 77, 78, 79, 80, 81, 82.

## Fixes from verification round 1 (2026-11-24)
- [x] **T-fix-1: Time zones checked (security High + Low).** The contract accepts only real time zones (due query and schedule body, 400 `/timeZone`); the minute job falls back to the meeting's zone and one bad entry can't stop it; minute-job errors get a log line.
- [x] **T-fix-2: Reminders follow single-meeting changes (bug High).** The job reads occurrence changes: no reminder for a cancelled one, the moved time for a moved one; `dueFor` reads all-day dates in the meeting's zone; occurrences moved into a range show.
- [x] **T-fix-3: Dismiss limits and Join check (security Medium + Low).** Rate limit on `POST /reminders/dismiss`, only real occurrences; desktop passes Join only when the card has it; a reminder card isn't pushed out silently (the page hears of it).
- [ ] **T-fix-4: Smaller bugs.** All-day end by calendar day; outbox result saving can't cause a second send; an unbuildable invite is marked failed; cancelled occurrences don't count toward 500.
- [ ] **T-fix-5: Failing tests.** db migration tests with migration 0013; TC-F02-102 (the schedule PATCH answers 404 to outsiders before checking the body); desktop F04 notice tests TC-F04-54, 67, 62.
- [ ] **T-fix-6: Chat in the details (AC-F13-04).** A Chat button for people who were in the meeting (F03's chat), or the AC reworded with the owner.
- [ ] **T-fix-7: UI review.** Month grid and the "more" list into packages/ui with stories and tests; FOCUS_RING; Upcoming loading and error states; ReminderCard announced; DateTimeField error on the time box; loading text; missing stories (NoticeCard invite, CalendarGrid states); trailing full stop in links.
- [ ] **T-fix-8: Unused code and screenshots.** Remove the 30 unused exports; make the screenshot baselines for the approved F13 look; then `pnpm check` green.
- [ ] **T-fix-9: Documents.** design.md, tests.md, overview, security, privacy-legal, operations, project-structure, F02 design, READMEs, glossary, progress; the spec uses the app's words ("Maybe", "This meeting / The series", the failed-invites text).
