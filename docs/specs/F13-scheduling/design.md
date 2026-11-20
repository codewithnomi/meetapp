---
feature: F13
title: Scheduling & calendar
status: approved
updated: 2026-11-20
---

# F13 Scheduling & calendar: Design (HOW)

## Summary (plain English)
A scheduled meeting is an ordinary F02 meeting with a date, a time, maybe a repeat rule, and a list of invited people. The server keeps the repeat as one short rule (the standard calendar format, "RRULE") and works out the dates when the calendar asks for them, up to a year ahead. Invites, updates and cancellations are emails with a standard calendar file attached (.ics), so Google Calendar, Outlook and Apple Calendar understand them. They go out through the existing email queue, so a slow mail server never slows the app. Members see changes live through the existing live line (D064). Reminders are timed jobs on the existing job queue (BullMQ), shown as MeetApp's corner cards (D085). The calendar screen and the form are new UI pieces, added to the design system first (D029), and look like Teams' Calendar.

## Screens / user flow
1. **Side menu → Calendar** (new item under Chat, before Meetings; icon "calendar"). Header: "Calendar", **Today**, ‹ ›, the date range, a view switch (Day / Work week / Week / Month, default Work week, remembered per computer), and **+ New meeting**.
2. **Grid** (Day/Week views): hours on the left (scrolls to 08:00 or the current time), one column per day, half-hour lines. Meetings are blocks placed by time; overlapping ones share the width side by side, up to 4, then a "+N more" chip that opens a list. The red now-line is in today's column. All-day meetings sit in a strip above the hours. **Month** shows a grid of days with up to 3 titles each and "+N more".
3. **Drag** on empty time (or click a half-hour slot) opens the form with that range filled in.
4. **Block** shows title, organizer, a "repeat" icon if part of a series; Join shows on it from 5 minutes before start until the end. Declined: dimmed and struck through. Tentative: striped. Clicking opens the **details panel** (side panel, as in Teams): title, time, repeat text ("Weekly on Mon, Wed until 31 Dec"), organizer, invitees with answer icons and counts, description (links clickable, open in the browser), link/ID/passcode with Copy (F02's JoinLinkCard), **Join**, **Chat** (F03 meeting chat), **Meeting options** (organizers, F02's dialog), answer buttons (Accept / Tentative / Decline with "This meeting" or "All in series"), **Edit** and **Cancel meeting** (organizers).
5. **Form** (full screen page `/calendar/new` and `/calendar/:meetingId/edit`, as in Teams): title, invitees (F14's PeoplePicker extended to accept any email), start date + time, end date + time, All day, Repeat (menu with the 6 choices; Weekly shows day toggles; an "End repeat" date), description (plain text area). **Send** (new) or **Send update** (edit), **Cancel**. Editing an occurrence of a series first asks "Edit this meeting / Edit the series". Cancel meeting asks for an optional message and "This meeting / The series".
6. **Meetings page** (F02): a new "Upcoming" card lists today's and tomorrow's scheduled meetings (Join when allowed) and "View calendar".
7. **Reminder**: corner card "Starts in 15 min · <title>" with **Join**, **Snooze** (5 min) and **Dismiss**; at the start time "Starting now". Clicking the card body opens the details.

## Data stored
New tables (via the `db-migration` skill). All five have `id`, `created_at`, `updated_at` and an indexed `workspace_id` (S2). The migration first adds `scheduled` to the `meeting_kind` list in its own step; F02 code that switches on `kind` (expiry, `extendedExpiry`, the Meetings list) is updated and covered by an integration test.
- **`meeting_schedules`** (one per scheduled meeting; F02 `meetings.kind` gains `scheduled`): `id`, `meeting_id` (unique, FK meetings, cascade), `starts_at`, `ends_at` (first occurrence, UTC), `time_zone` (organizer's IANA zone), `all_day` (bool), `rrule` (text or null, e.g. `FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=…`), `repeat_until` (null = no end), `description` (≤ 2,000), `sequence` (int, +1 per change, for the .ics), `cancelled_at`.
- **`meeting_occurrence_changes`** (single-occurrence edits and cancellations): `meeting_id`, `original_start` (which occurrence), `cancelled` (bool), `starts_at`, `ends_at`, `title`, `description` (nulls = unchanged). Unique (`meeting_id`, `original_start`).
- **`meeting_invitees`**: `id`, `meeting_id`, `user_id` (member, nullable) or `email_enc` + `email_lookup` (external; encrypted + keyed hash, as F02 stores secrets), `answer` (`none` | `accepted` | `tentative` | `declined`), `answered_at`, `email_status` (`queued` | `sent` | `failed`). Unique per meeting and person/email. At most 250 (checked in the service and by a trigger).
- **`meeting_invitee_answers`** (an answer for one occurrence): `invitee_id`, `original_start`, `answer`.
- **`reminder_dismissals`**: `user_id`, `meeting_id`, `original_start`, `kind` (`before` | `start`), `snoozed_until` (null, or when to show again) so a reminder shows once per person across windows and devices (AC-F13-21).
- Expiry (D093): for scheduled meetings `meetings.expires_at` = last occurrence end + 60 days; a series without end date gets `expires_at` = far future and is recalculated when the rule gets an end. F02's `extendedExpiry` leaves scheduled meetings unchanged.
- Privacy (AC-F13-30): external emails live only in `meeting_invitees`; a daily sweep deletes invitee rows of meetings cancelled or expired more than 30 days ago. Account and workspace deletion cascade. Email jobs in the queue hold only the invitee id and the kind of email; the address is decrypted in the worker, so no plain address sits in Redis. A cancellation to someone just removed by an update (their row is gone) carries their member id, or their address still sealed (encrypted, as stored).

## Backend endpoints / messages
New module `apps/api/src/modules/scheduling/` (routes → service → repository, as the other modules). All need a signed-in workspace member; inputs checked with Zod in `packages/contracts`.
- `GET /workspaces/:ws/calendar?from&to` → occurrences in the range (max 42 days per request) the person organizes or is invited to: `{ meetingId, originalStart, startsAt, endsAt, allDay, title, organizer, repeats, myAnswer, cancelled:false, canJoin }`. Occurrences are expanded with **rrule-temporal** in the meeting's time zone, at most 1 year ahead. If a range would return more than 500 occurrences, the response says `truncated: true` and the calendar shows "+N more".
- `GET /meetings/:id/schedule` → details (invitees with names and answers; external emails only for organizers, AC-F13-26/27).
- `POST /workspaces/:ws/scheduled-meetings` → create (title, invitees, start, end, allDay, timeZone, repeat, description). Creates the F02 meeting (`kind: scheduled`) and schedule in one transaction, then queues emails. Errors: 400 field errors (checked on the server too: no title or over 100 characters, end not after start, start more than 5 minutes ago, description over 2,000, over 250 invitees, a bad email), 429 with wait time (F02's 50/hour; emails 1,000/hour checked **before** anything is saved, AC-F13-14, 27).
- `PATCH /meetings/:id/schedule` `{ scope: "occurrence" | "series", originalStart?, …changes }` → update; series time change resets answers and clears occurrence changes (AC-F13-18). Organizer/co-organizer only: an invitee gets 403 (they can see the meeting anyway), anyone else 404.
- `POST /meetings/:id/schedule/cancel` `{ scope, originalStart?, message? }`.
- `PUT /meetings/:id/schedule/answer` `{ answer, scope, originalStart? }` (invited members only).
- `POST /meetings/:id/schedule/resend` → re-queue emails that failed (AC-F13-31).
- `POST /reminders/dismiss` `{ meetingId, originalStart, kind, snoozeMinutes? }` (5 = Snooze; the job sends the reminder again when `snoozed_until` passes, on every device), `GET /reminders/due` (on app start and reconnect: only meetings not yet ended, AC-F13-22).
- **Live line** (`user:<id>` channel, D064): `{ t: "calendar", meetingId, change: "added" | "changed" | "removed" }` to organizer and member invitees; `{ t: "reminder", meetingId, originalStart, kind }` when a reminder is due; `{ t: "reminder-dismissed", … }` so other windows/devices close the card.
- **Jobs** (BullMQ queue `scheduling`): a "reminders" job every minute finds occurrences starting in 15 minutes or now (window of the last minute, so a restart misses nothing) and sends `reminder` to members who haven't declined, haven't dismissed, and aren't in Do not disturb (the app decides DND, F04). All-day occurrences get one reminder at 09:00 in the person's own time zone (the app reports its zone when the line connects), never 15 minutes before 00:00 (AC-F13-07). A daily "privacy sweep" (AC-F13-30).
- **Emails** (existing outbox, `apps/api/src/emails`): new templates `meeting-invite`, `meeting-update`, `meeting-cancel`, each with text + HTML and an `.ics` attachment built with **ical-generator**: `METHOD:REQUEST` (invite/update) or `CANCEL`, stable `UID` = meeting id, `SEQUENCE`, `DTSTART;TZID`, `RRULE`, `EXDATE`s for cancelled occurrences and `RECURRENCE-ID` events for changed ones, `ORGANIZER`, `ATTENDEE;RSVP=FALSE` (answers aren't tracked by email, AC-F13-16). Footer: who invited you and why (AC-F13-30). The provider sends the calendar file as nodemailer's `icalEvent` (the calendar part plus `invite.ics`). Times in the file are written in the meeting's own zone (TZID), never the server's. The outbox gains an optional result callback: after the queue's last of its 5 tries the invitee row is marked `failed` (or `sent`); the details panel shows "Some invites couldn't be sent", and Retry re-queues only `failed` rows.
- **Meeting chat (AC-F13-04):** unchanged from F03 (opens for people who joined the meeting). Chat before the meeting for invited members is a follow-up feature (D096).
- Member invitees also get a corner card through the live line `{ t: "invited", … }` (AC-F13-17), controlled by a new notification setting "Meeting invites" (F04 settings).

## Edge cases & errors
- **Time zones and summer time:** stored in UTC plus the organizer's zone; rrule expands in that zone, so a 09:00 weekly meeting stays 09:00 for the organizer across summer-time changes; others see it converted.
- **Monthly on 29–31:** the rule is `FREQ=MONTHLY;BYMONTHDAY=28,…,<day>;BYSETPOS=-1` (e.g. day 30 → `BYMONTHDAY=28,29,30;BYSETPOS=-1`): the chosen day when the month has it, otherwise the month's last day. Standard RFC 5545, understood by Google, Outlook and Apple; unit-tested (AC-F13-11).
- **Series edits:** one occurrence → a row in `meeting_occurrence_changes` + `RECURRENCE-ID` in the update email; whole series time → warning, answers reset, occurrence changes dropped.
- **Join for an occurrence:** the same F02 link; the pre-join shows the occurrence's time. Join is shown from 5 min before start until end; the link itself works whenever F02 allows (as in Teams).
- **Workspace changes:** an invitee who leaves loses access (queries join on membership); an organizer who leaves → F02 stops the meeting, and a cancellation email goes to all invitees (AC-F13-29).
- **Offline:** the calendar keeps its last loaded data (TanStack Query cache), shows F14's offline notice, and disables the buttons that change things (AC-F13-32).
- **Email failure:** the meeting is saved first; failed sends show "Some invites couldn't be sent" + Retry in the details panel.
- **Duplicates across devices:** reminders dismissed on one device close on the others through the live line.
- **Big series:** expansion is capped at 1 year ahead and 500 occurrences per request.

## Security & privacy
- Every scheduling query is scoped by workspace and by "organizer, co-organizer or invited member"; anything else is 404 (S2, AC-F13-26). Permission checks live in `scheduling.permissions.ts` with unit tests for each role.
- External emails encrypted at rest (as F02's link secrets) with a keyed hash for lookups; shown only to organizers (AC-F13-27); deleted by the sweep (AC-F13-30).
- Title and description are stored and shown as plain text; React escapes them; email HTML escapes them; links are auto-linked and open with the desktop app's external-link rule (AC-F13-28). The .ics escapes text per RFC 5545 (the library does this).
- Rate limits (S5): 50 meetings/hour (F02), 1,000 meeting emails/hour per person: the needed number is reserved atomically in Redis (INCRBY with expiry) before the transaction and given back if it fails, so two Sends at once can't get past it.
- Emails only through the app's mail service; no open relay: recipients are only the invitees of a meeting the sender organizes.

## Cost impact
None now: Mailpit locally (free). Online later, the email service's free tier (e.g. 3,000 emails/month) covers early use; noted for F10.

## Test approach
- **Unit:** repeat expansion (every choice, end dates, month ends, summer time, 1-year cap), the .ics builder (REQUEST/CANCEL, SEQUENCE, RRULE, EXDATE, RECURRENCE-ID, escaping), form validation, permissions per role, reminder timing.
- **Integration (real Postgres/Redis, Mailpit):** create/edit/cancel/answer endpoints, 404 for outsiders, limits (429 before saving), emails in Mailpit with a valid .ics, live line events, reminder job, privacy sweep, organizer leaving.
- **Component + stories + screenshots:** CalendarGrid, MeetingBlock, DateTimeField, RepeatPicker, ScheduleForm, MeetingDetailsPanel, ReminderCard, light and dark.
- **Desktop (F13's own spec file, D092):** schedule → it shows for the invitee live → answer → organizer sees it; edit/cancel; reminder card with Join; keyboard-only scheduling; axe on the calendar.
- AC coverage: every AC-F13-01…32 gets at least one test in tests.md:

| AC | Level |
|---|---|
| 01, 02, 05, 06 | component + desktop |
| 03, 04, 23 | component + desktop |
| 07, 08, 10, 11 | unit (rules, validation, all-day reminder) + component; 10 also integration (server checks) |
| 09, 12, 13, 14 | integration + desktop (09); 13 includes F02 `kind` handling |
| 15 | unit (.ics) + integration (Mailpit) |
| 16, 18, 19 | integration + desktop |
| 17 | integration (live line) + component (the "Meeting invites" setting) |
| 20 | integration (403 invitee, 404 outsider) |
| 21, 22 | unit (timing, snooze) + integration (job) + component (settings, Do not disturb) + desktop (21) |
| 24 | component (axe, keyboard) + desktop (keyboard-only scheduling) |
| 25 | translation-key check + component tests in another language and region |
| 26, 27 | integration (only organizers see external emails; outsiders 404) |
| 28 | unit (escaping in app, email HTML and .ics) + desktop (description link opens the browser) |
| 29 | integration (invitee leaves; organizer leaves → cancellation emails) |
| 30 | integration (sweep after 30 days; footer checked in Mailpit; no address in queue data) |
| 31 | integration (failed send marked, Retry) |
| 32 | component (offline: data kept, buttons disabled) |

## Decisions made here
- **D094 (proposed):** libraries **rrule-temporal** (repeat rules, RFC 5545) and **ical-generator** (calendar files); vetted with the `add-dependency` skill at the first task that needs them.
- **D095 (proposed):** a scheduled meeting is an F02 meeting with `kind: scheduled` plus a schedule; repeats are stored as one rule and expanded on read, not stored per occurrence.
- **Design system first (D029):** Calendar grid, meeting block, date/time field, repeat picker, schedule form, details panel and reminder card are added to the design system and screen designs before their UI tasks; the owner sees them at that milestone.
