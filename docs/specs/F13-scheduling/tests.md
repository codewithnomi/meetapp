---
feature: F13
title: Scheduling & calendar
status: approved
updated: 2026-11-20
---

# F13 Scheduling & calendar: Test Cases

Written **before** the code. Each test case becomes an automated test.
Levels: unit, component (React, Vitest), integration (real Postgres, Redis, Mailpit), desktop (real Electron windows, Playwright), visual (component screenshots), security, performance.

Test names must include the TC and AC IDs, e.g. `TC-F13-02 [AC-F13-11] monthly on the 31st falls on the last day of short months`.

**Set-up:**
- Unit and component tests use a fake clock, fake time zones and fake API data. Integration tests use the test backend (`test-support/`), Mailpit and real Redis; a fake clock moves the reminder job and the sweep.
- Per D092, all desktop cases go in ONE file, `tests/e2e/desktop/calendar.spec.ts`, and stay few; detail is tested lower down.
- Security cases follow `docs/architecture/security.md`: S2 (workspace scoping, TC-F13-57 to 60), S5 (limits, TC-F13-49 to 51), escaping (TC-F13-09, 44, 73) and the privacy sweep (TC-F13-70, 71, 74).
- The F02, F03, F04 and F14 suites must keep passing; F02's kind handling is covered by TC-F13-64.
- Performance: the 500-occurrence cap (TC-F13-04, 67) and the 1-year cap keep a calendar read small; no separate load test is needed.

## Test cases

### TC-F13-01: Repeat choices expand correctly
- **Covers:** AC-F13-11
- **Level:** unit
- **File:** `apps/api/src/modules/scheduling/scheduling.recurrence.test.ts`
- **Given** a start and each choice: none, every weekday, daily, weekly on Mon+Wed, monthly, yearly, each with and without an end date
- **When** occurrences are expanded for a range
- **Then** each gives the right dates; weekday skips weekends; an end date stops the series; no end date runs to the cap

### TC-F13-02: Monthly on the 29th to 31st
- **Covers:** AC-F13-11
- **Level:** unit
- **File:** `apps/api/src/modules/scheduling/scheduling.recurrence.test.ts`
- **Given** a monthly meeting on the 29th, 30th and 31st, over a year with 28-, 29-, 30- and 31-day months
- **When** the rule is built and expanded
- **Then** the rule is `FREQ=MONTHLY;BYMONTHDAY=28,..;BYSETPOS=-1` as in the design; each occurrence is the chosen day, or the last day of a shorter month, never skipped or doubled

### TC-F13-03: Summer time keeps the organizer's hour
- **Covers:** AC-F13-02, AC-F13-11
- **Level:** unit
- **File:** `apps/api/src/modules/scheduling/scheduling.recurrence.test.ts`
- **Given** a weekly 09:00 meeting in Europe/Berlin across the March and October changes
- **When** occurrences are expanded
- **Then** each starts at 09:00 Berlin time (different UTC hours); in another zone the converted time shifts accordingly

### TC-F13-04: One year and 500 caps
- **Covers:** AC-F13-11
- **Level:** unit
- **File:** `apps/api/src/modules/scheduling/scheduling.recurrence.test.ts`
- **Given** a daily meeting with no end date, and a range that would hold more than 500
- **When** expanded for a far-future range and for a dense range
- **Then** nothing later than 1 year ahead appears; over 500 gives `truncated: true`

### TC-F13-05: Link expiry for scheduled meetings
- **Covers:** AC-F13-13
- **Level:** unit
- **File:** `apps/api/src/modules/scheduling/scheduling.expiry.test.ts`
- **Given** a single meeting, a series with an end date, a series without one, then a series that gets an end
- **When** the expiry is calculated
- **Then** single and ended series: last occurrence end + 60 days; no end date: far future; adding an end recalculates it

### TC-F13-06: Calendar file for an invite or update
- **Covers:** AC-F13-15, AC-F13-18
- **Level:** unit
- **File:** `apps/api/src/modules/scheduling/scheduling.ics.test.ts`
- **Given** a single and a repeating meeting with a description
- **When** the .ics is built
- **Then** `METHOD:REQUEST`, stable UID = meeting id, SEQUENCE grows per change, `DTSTART;TZID`, `RRULE`, ORGANIZER, `ATTENDEE;RSVP=FALSE`; parses with a standard iCalendar parser

### TC-F13-07: Calendar file for one changed or skipped occurrence
- **Covers:** AC-F13-18, AC-F13-19
- **Level:** unit
- **File:** `apps/api/src/modules/scheduling/scheduling.ics.test.ts`
- **Given** a series with one cancelled and one moved occurrence
- **When** the .ics is built
- **Then** the cancelled one is an `EXDATE`; the moved one is a `RECURRENCE-ID` event with the new time

### TC-F13-08: Calendar file for a cancellation
- **Covers:** AC-F13-19
- **Level:** unit
- **File:** `apps/api/src/modules/scheduling/scheduling.ics.test.ts`
- **Given** a cancelled meeting, and a cancelled series
- **When** the .ics is built
- **Then** `METHOD:CANCEL` with the same UID and a higher SEQUENCE

### TC-F13-09: Plain-text escaping in the .ics, email HTML and text
- **Covers:** AC-F13-28
- **Level:** unit
- **File:** `apps/api/src/modules/scheduling/scheduling.ics.test.ts and apps/api/src/modules/scheduling/scheduling.mail.test.ts`
- **Given** a title and description with `<script>`, `<img onerror>`, commas, semicolons, newlines and a link
- **When** the .ics, the HTML and the text email are built
- **Then** HTML is escaped, the .ics follows RFC 5545 escaping, a link is clickable in HTML, and nothing runs

### TC-F13-10: Form validation rules
- **Covers:** AC-F13-07, AC-F13-08, AC-F13-10
- **Level:** unit
- **File:** `apps/web/src/features/scheduling/schedule-validation.test.ts`
- **Given** a form value
- **When** validated
- **Then** no title, 101-character title, end not after start, start over 5 minutes ago (4 minutes allowed), description over 2,000, bad email, 251 invitees each give their own field error; a valid form passes; defaults are the next half hour, 30 minutes; above 100 invitees a note is returned

### TC-F13-11: The same rules in the shared contract
- **Covers:** AC-F13-10
- **Level:** unit
- **File:** `packages/contracts/src/scheduling.test.ts`
- **Given** the Zod create and update schemas
- **When** bad and good bodies are parsed
- **Then** the same limits as TC-F13-10 hold on the server's schema

### TC-F13-12: Permissions per role
- **Covers:** AC-F13-20, AC-F13-26
- **Level:** unit
- **File:** `apps/api/src/modules/scheduling/scheduling.permissions.test.ts`
- **Given** organizer, co-organizer, invited member, external-only person, other member, member of another workspace
- **When** each asks to see, edit, cancel, answer, see external emails
- **Then** organizer and co-organizer: all; invited member: see and answer only; others: not found

### TC-F13-13: Reminder timing
- **Covers:** AC-F13-21, AC-F13-22
- **Level:** unit
- **File:** `apps/api/src/modules/scheduling/reminders.test.ts`
- **Given** occurrences at now+15 min, at now, ended, declined, cancelled, already dismissed, with a one-minute window
- **When** the due list is worked out
- **Then** only 15-minute and start-time reminders of not-ended, not-declined, not-cancelled, not-dismissed ones are due; one that straddles a job restart is not missed or doubled

### TC-F13-14: All-day reminder at 09:00
- **Covers:** AC-F13-07, AC-F13-21
- **Level:** unit
- **File:** `apps/api/src/modules/scheduling/reminders.test.ts`
- **Given** an all-day meeting and people in two time zones
- **When** the due list is worked out around 00:00 and 09:00 in each zone
- **Then** none 15 minutes before 00:00; exactly one at 09:00 in the person's own zone

### TC-F13-15: Snooze
- **Covers:** AC-F13-21
- **Level:** unit
- **File:** `apps/api/src/modules/scheduling/reminders.test.ts`
- **Given** a reminder snoozed for 5 minutes
- **When** time passes
- **Then** it is not due for 5 minutes, then due again once; Dismiss ends it for that kind only

### TC-F13-16: Overlap layout
- **Covers:** AC-F13-01
- **Level:** unit
- **File:** `packages/ui/src/organisms/CalendarGrid/layout.test.ts`
- **Given** 1, 4 and 6 meetings at the same time, and partly overlapping ones
- **When** positions are worked out
- **Then** up to 4 share the width side by side; the rest become one "+N more" with the right N

### TC-F13-17: Time zone and 12/24-hour format
- **Covers:** AC-F13-02, AC-F13-25
- **Level:** unit
- **File:** `apps/web/src/features/scheduling/time-format.test.ts`
- **Given** a zone and a 12- or 24-hour setting, in en-US and de-DE
- **When** times and dates are formatted
- **Then** they follow the computer's zone, hour setting, language and region

### TC-F13-18: Calendar opens on the work week
- **Covers:** AC-F13-01
- **Level:** component
- **File:** `apps/web/src/pages/CalendarPage/CalendarPage.test.tsx`
- **Given** a member with meetings Mon-Sun
- **When** Calendar opens
- **Then** five columns Monday-Friday, each meeting a block with title and organizer at its time; the weekend meeting is not in the grid

### TC-F13-19: View switch, back, forward and Today
- **Covers:** AC-F13-01
- **Level:** component
- **File:** `apps/web/src/pages/CalendarPage/CalendarPage.test.tsx`
- **Given** the calendar
- **When** Day, Week, Month, ‹, › and Today are used
- **Then** each shows the right range; Today returns to the current date; the chosen view is remembered after reopening

### TC-F13-20: Calendar shows only the open workspace
- **Covers:** AC-F13-01
- **Level:** component
- **File:** `apps/web/src/pages/CalendarPage/CalendarPage.test.tsx`
- **Given** meetings in workspaces A and B
- **When** the member switches from A to B
- **Then** only B's meetings show, and the request carries B's id

### TC-F13-21: Now line in today's column
- **Covers:** AC-F13-02
- **Level:** component
- **File:** `packages/ui/src/organisms/CalendarGrid/CalendarGrid.test.tsx`
- **Given** a fake clock at 10:20
- **When** the week renders, then the clock moves
- **Then** a red line sits in today's column only, at 10:20, and moves

### TC-F13-22: Join button window
- **Covers:** AC-F13-03
- **Level:** component
- **File:** `packages/ui/src/organisms/MeetingBlock/MeetingBlock.test.tsx`
- **Given** a meeting starting in 6 min, 5 min, now (half over) and ended
- **When** each renders
- **Then** Join shows from 5 minutes before start until the end only, and goes to the pre-join of that meeting or occurrence; the same on the details panel

### TC-F13-23: Block states and spoken text
- **Covers:** AC-F13-06, AC-F13-24
- **Level:** component
- **File:** `packages/ui/src/organisms/MeetingBlock/MeetingBlock.test.tsx`
- **Given** answers Declined, Tentative, Accepted and No answer, in a series
- **When** blocks render
- **Then** Declined is dimmed and struck through but present; Tentative striped; a repeat icon for a series; the accessible name reads title, time and the person's answer

### TC-F13-24: Details panel content
- **Covers:** AC-F13-04
- **Level:** component
- **File:** `packages/ui/src/organisms/MeetingDetailsPanel/MeetingDetailsPanel.test.tsx`
- **Given** a series with invitees of every answer, description, link, ID and passcode
- **When** a block is clicked
- **Then** the panel shows title, time, repeat text, organizer, invitees with answers and counts, description, link/ID/passcode with Copy, Join, Chat and (for invitees) the answer buttons; organizers also see Edit, Cancel meeting and Meeting options

### TC-F13-25: Empty calendar hint
- **Covers:** AC-F13-05
- **Level:** component
- **File:** `apps/web/src/pages/CalendarPage/CalendarPage.test.tsx`
- **Given** no meetings in the period
- **When** the calendar shows
- **Then** the hint "No meetings. Select New meeting to schedule one." shows; it goes away when there is one

### TC-F13-26: Form fields and defaults
- **Covers:** AC-F13-07
- **Level:** component
- **File:** `packages/ui/src/organisms/ScheduleForm/ScheduleForm.test.tsx`
- **Given** New meeting pressed, and a drag over 14:00-15:30
- **When** the form opens
- **Then** fields are title, invitees, start, end, all day, repeat, description; the default is the next half hour for 30 minutes; the dragged range fills start and end; title stops at 100 and description at 2,000

### TC-F13-27: All day hides the time
- **Covers:** AC-F13-07
- **Level:** component
- **File:** `packages/ui/src/organisms/ScheduleForm/ScheduleForm.test.tsx`
- **Given** the form
- **When** All day is turned on and off
- **Then** time fields hide and show; the value spans the whole day in the organizer's zone

### TC-F13-28: Invitee suggestions and any email
- **Covers:** AC-F13-08
- **Level:** component
- **File:** `packages/ui/src/organisms/ScheduleForm/ScheduleForm.test.tsx`
- **Given** workspace members and typed text
- **When** typing a name, an email, a valid outside email and a bad one
- **Then** members are suggested by name or email; a valid outside email is added as external; a bad one is not; the 100-person note shows above 100; the 251st is refused

### TC-F13-29: Field errors stop Send
- **Covers:** AC-F13-10
- **Level:** component
- **File:** `packages/ui/src/organisms/ScheduleForm/ScheduleForm.test.tsx`
- **Given** a form with each error from TC-F13-10
- **When** Send is pressed
- **Then** each field says what is wrong, focus goes to the first, and no request is sent

### TC-F13-30: Repeat picker
- **Covers:** AC-F13-11
- **Level:** component
- **File:** `packages/ui/src/organisms/RepeatPicker/RepeatPicker.test.tsx`
- **Given** the picker
- **When** each of the six choices is picked
- **Then** the six choices exist; Weekly shows day toggles; End repeat is optional and empty by default; the text reads like "Weekly on Mon, Wed until 31 Dec"

### TC-F13-31: Too many meetings or emails: wait time
- **Covers:** AC-F13-14, AC-F13-27
- **Level:** component
- **File:** `apps/web/src/features/scheduling/schedule-form-errors.test.tsx`
- **Given** the server answers 429 for meetings, then for emails, with a wait
- **When** Send is pressed
- **Then** the form stays filled and says how long to wait, for each reason

### TC-F13-32: Answer buttons
- **Covers:** AC-F13-16
- **Level:** component
- **File:** `packages/ui/src/organisms/MeetingDetailsPanel/MeetingDetailsPanel.test.tsx`
- **Given** an invited member on a series
- **When** Accept, Tentative, Decline are pressed with "This meeting" and "All in series"
- **Then** the right request is sent with the scope and the occurrence; the pressed answer shows as chosen; an organizer-only view has no answer buttons

### TC-F13-33: Edit asks this one or the series
- **Covers:** AC-F13-18
- **Level:** component
- **File:** `packages/ui/src/organisms/ScheduleForm/ScheduleForm.test.tsx`
- **Given** editing one occurrence of a series, and a change to the series time
- **When** the choice is made and Send update pressed
- **Then** it asks "This meeting / The series"; a series time change warns that answers reset and single changes are dropped, and goes ahead only after confirming

### TC-F13-34: Cancel dialog
- **Covers:** AC-F13-19
- **Level:** component
- **File:** `packages/ui/src/organisms/MeetingDetailsPanel/MeetingDetailsPanel.test.tsx`
- **Given** a series
- **When** Cancel meeting is pressed
- **Then** it offers an optional message and "This meeting / The series", and sends the chosen scope and message

### TC-F13-35: Invitee cannot edit or cancel
- **Covers:** AC-F13-20
- **Level:** component
- **File:** `packages/ui/src/organisms/MeetingDetailsPanel/MeetingDetailsPanel.test.tsx`
- **Given** an invited member who is not an organizer, and a co-organizer
- **When** the panel shows
- **Then** the invitee has no Edit, Cancel or Meeting options; the co-organizer does; the edit page for the invitee shows "not found"

### TC-F13-36: Reminder card
- **Covers:** AC-F13-21
- **Level:** component
- **File:** `packages/ui/src/organisms/ReminderCard/ReminderCard.test.tsx`
- **Given** a 15-minute and a start-time reminder
- **When** the card shows and its buttons are pressed
- **Then** it reads "Starts in 15 min · title" or "Starting now"; Join opens the pre-join; Snooze sends 5 minutes; Dismiss sends dismiss; clicking the body opens the details; a `reminder-dismissed` event closes it

### TC-F13-37: Reminder and invite settings, Do not disturb
- **Covers:** AC-F13-17, AC-F13-21
- **Level:** component
- **File:** `apps/web/src/features/scheduling/scheduling-notices.test.tsx`
- **Given** the "Meeting invites" setting on and off, and Do not disturb on and off
- **When** an `invited` and a `reminder` event arrive
- **Then** an invite card "<Organizer> invited you to <title>" shows only when the setting is on; reminders follow F04 settings and show nothing in Do not disturb; both on a second window show once

### TC-F13-38: Upcoming card on Meetings
- **Covers:** AC-F13-23
- **Level:** component
- **File:** `apps/web/src/pages/MeetingsPage/MeetingsPage.test.tsx`
- **Given** scheduled meetings today, tomorrow and the day after
- **When** Meetings opens
- **Then** only today's and tomorrow's show with title, time, Join when allowed, and a "View calendar" link; empty list shows no card clutter

### TC-F13-39: Failed invites notice
- **Covers:** AC-F13-31
- **Level:** component
- **File:** `packages/ui/src/organisms/MeetingDetailsPanel/MeetingDetailsPanel.test.tsx`
- **Given** an organizer's meeting with a failed invitee
- **When** the panel shows, then Retry is pressed
- **Then** "Some invites couldn't be sent" with Retry shows for organizers only; Retry calls resend and the notice goes when none fail

### TC-F13-40: Offline
- **Covers:** AC-F13-32
- **Level:** component
- **File:** `apps/web/src/pages/CalendarPage/CalendarPage.test.tsx`
- **Given** data loaded, then the connection drops
- **When** the calendar shows
- **Then** the last data stays with the offline notice; Send, Send update, Cancel and the answer buttons are disabled; they work again online

### TC-F13-41: Keyboard and screen reader
- **Covers:** AC-F13-24
- **Level:** component
- **File:** `apps/web/src/pages/CalendarPage/CalendarPage.a11y.test.tsx`
- **Given** the calendar, details panel and form
- **When** used only with the keyboard, and checked with axe
- **Then** every block, button and field can be reached and used, with a visible focus; blocks read title, time and answer; no axe errors

### TC-F13-42: Every text is translated
- **Covers:** AC-F13-25
- **Level:** component
- **File:** `apps/web/src/features/scheduling/locales.test.ts`
- **Given** all keys used by the new screens
- **When** the translation check runs
- **Then** each key exists in every language file; no fixed English text remains in the new components

### TC-F13-43: Another language and region
- **Covers:** AC-F13-02, AC-F13-25
- **Level:** component
- **File:** `apps/web/src/pages/CalendarPage/CalendarPage.test.tsx`
- **Given** the language and region set to German and to Japanese, 24-hour
- **When** the calendar and form render
- **Then** dates, weekday names and first day of the week follow them

### TC-F13-44: Description links and plain text
- **Covers:** AC-F13-28
- **Level:** component
- **File:** `packages/ui/src/organisms/MeetingDetailsPanel/MeetingDetailsPanel.test.tsx`
- **Given** a description with `<b>x</b><script>` and a link
- **When** the panel shows it
- **Then** the tags show as text, the link is clickable and opens with the external-link rule, not in the app

### TC-F13-45: External emails hidden from non-organizers
- **Covers:** AC-F13-26, AC-F13-27
- **Level:** component
- **File:** `packages/ui/src/organisms/MeetingDetailsPanel/MeetingDetailsPanel.test.tsx`
- **Given** an invitee list with external people, shown to an organizer and to an invited member
- **When** the panel shows
- **Then** the organizer sees the addresses; the invited member sees no external address

### TC-F13-46: Pictures of the new parts
- **Covers:** AC-F13-24
- **Level:** visual
- **File:** `packages/ui/src/organisms/*/*.stories.tsx`
- **Given** stories for CalendarGrid, MeetingBlock, DateTimeField, RepeatPicker, ScheduleForm, MeetingDetailsPanel, ReminderCard in every state
- **When** the screenshot check runs in light and dark
- **Then** pictures match, and the gallery axe check (contrast, WCAG 2.2 AA) passes

### TC-F13-47: Create a scheduled meeting
- **Covers:** AC-F13-09, AC-F13-13
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.integration.test.ts`
- **Given** a signed-in member and invitees (members and one outside email)
- **When** they POST a valid meeting
- **Then** 201; the F02 meeting has `kind: scheduled` and the sender as organizer; schedule, invitees and one email each are created in one transaction; it is in the organizer's and each member invitee's calendar within 5 seconds, with a live `calendar: added` event

### TC-F13-48: Server refuses wrong fields
- **Covers:** AC-F13-10
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.integration.test.ts`
- **Given** the TC-F13-10 errors, sent straight to the API
- **When** each is POSTed
- **Then** 400 with the field named; no meeting, invitee or email exists afterwards

### TC-F13-49: 50 meetings an hour
- **Covers:** AC-F13-14
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.integration.test.ts`
- **Given** a member who created 50 scheduled meetings this hour
- **When** they create a 51st
- **Then** 429 with the wait time; nothing created; counted with F02's limit

### TC-F13-50: 1,000 emails an hour refused before saving
- **Covers:** AC-F13-27
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.emails.integration.test.ts and apps/api/src/plugins/rate-limit.test.ts`
- **Given** a person near 1,000 meeting emails this hour
- **When** a Send, then a Send update and a cancellation, would go over
- **Then** 429 with the wait time; nothing is created or changed; updates and cancellations count

### TC-F13-51: Two Sends at once cannot pass the email limit
- **Covers:** AC-F13-27
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.emails.integration.test.ts`
- **Given** a person with room for one 600-email Send only
- **When** two such Sends are sent at the same moment
- **Then** exactly one succeeds; the reserved count is given back when a transaction fails

### TC-F13-52: Invite email in Mailpit
- **Covers:** AC-F13-15, AC-F13-30
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.emails.integration.test.ts`
- **Given** a created meeting with an outside and a member invitee
- **When** the queue runs
- **Then** each gets an email with title, time and zone, organizer, description, Join link, ID and passcode, and a valid .ics attachment (repeat rule included); the footer names who invited them and why

### TC-F13-53: Answers reach the organizer
- **Covers:** AC-F13-16
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.answers.test.ts`
- **Given** an invited member
- **When** they PUT Accept, Tentative and Decline for the series and for one occurrence
- **Then** answers are saved; the organizer's live line gets the change within 5 seconds; the occurrence answer overrides the series one only for that date; an external person shows "No answer"; a non-invited member gets 404

### TC-F13-54: Invited member notification
- **Covers:** AC-F13-17
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.live.test.ts`
- **Given** an invited member online
- **When** they are invited
- **Then** an `invited` event with organizer name and title arrives on their line; nothing is sent to the organizer; a member added later by an update also gets it

### TC-F13-55: Update sends emails and live changes
- **Covers:** AC-F13-18
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.update.test.ts`
- **Given** a series with invitees
- **When** the organizer then a co-organizer PATCH title, time, invitees, description, for one occurrence and for the series
- **Then** everyone's calendar changes within 5 seconds; updated .ics (higher SEQUENCE) emailed; removed invitees get a cancellation, added ones a new invite; a whole-series time change resets answers to none and deletes occurrence changes; the invitee is removed from the meeting chat

### TC-F13-56: Cancel an occurrence and the series
- **Covers:** AC-F13-19
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.cancel.test.ts`
- **Given** a series with a message
- **When** the organizer cancels one occurrence, then the series
- **Then** the occurrence is skipped (EXDATE); the series leaves every calendar, the cancellation emails carry the message and `METHOD:CANCEL`, and the link stops working for the series; calendar `removed` events arrive

### TC-F13-57: Only organizers may change; others see nothing
- **Covers:** AC-F13-20, AC-F13-26
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.permissions.test.ts`
- **Given** an organizer, co-organizer, invited member, uninvited member and an outsider
- **When** each tries to read, PATCH, cancel, resend and answer
- **Then** invitee: 403 on change, cancel, resend; uninvited member and outsider: 404 on everything with the same body as a missing meeting; nothing changes

### TC-F13-58: Workspace scoping
- **Covers:** AC-F13-26
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.integration.test.ts`
- **Given** a meeting in workspace A and a member of both A and B not invited
- **When** calendar and details are asked through workspace B's path and A's path
- **Then** B's calendar never lists it; details through any path give 404; a calendar range over 42 days gives 400

### TC-F13-59: Invitee names visible, external emails only to organizers
- **Covers:** AC-F13-26, AC-F13-27
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.integration.test.ts`
- **Given** a meeting with members and outside invitees
- **When** an invited member, a co-organizer and the organizer ask for the details
- **Then** the invited member sees member names and answers but no outside address; organizers see the addresses; the response never contains the hash or the encrypted value

### TC-F13-60: External people are not in the app calendar
- **Covers:** AC-F13-26
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.integration.test.ts`
- **Given** an outside invitee who later signs up with the same email
- **When** they open the calendar, and the meeting link
- **Then** the calendar does not list it unless they were invited as a member; the link opens the F02 pre-join

### TC-F13-61: Chat before the meeting
- **Covers:** AC-F13-04
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.chat.test.ts`
- **Given** an invited member, an uninvited member
- **When** each opens the meeting chat before it starts, after being uninvited, and after cancellation
- **Then** the invited member can, the others get 404

### TC-F13-62: Reminders job
- **Covers:** AC-F13-21, AC-F13-22
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/reminders.job.test.ts`
- **Given** real Redis and Postgres, meetings in 15 minutes and now, a declined one, a cancelled one, a dismissed one, one person with two windows
- **When** the job runs, twice, and after a restart with a gap of a few minutes
- **Then** one `reminder` per eligible person and kind; none for declined, cancelled or dismissed; a snooze sends again once at its time; `reminder-dismissed` goes out on dismiss

### TC-F13-63: Due reminders on start
- **Covers:** AC-F13-22
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/reminders.due.test.ts`
- **Given** meetings that have ended, are running and are coming
- **When** the app asks `GET /reminders/due`
- **Then** only meetings not yet ended are returned

### TC-F13-64: F02 behaviour for scheduled meetings
- **Covers:** AC-F13-13
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.integration.test.ts`
- **Given** a scheduled meeting
- **When** people join, the lobby is used, roles are set, 100 people join, the F02 expiry runs, `extendedExpiry` runs and the meetings list is read
- **Then** lobby, roles and limits behave as F02; the scheduler is the organizer; `extendedExpiry` leaves it unchanged; the list handles the new `kind`

### TC-F13-65: Link works until 60 days after the last occurrence
- **Covers:** AC-F13-13
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.integration.test.ts`
- **Given** an ended series and a series without end date, with a fake clock
- **When** joining is tried at day 59 and day 61, and a year later
- **Then** ended: works at 59, "expired" at 61; no end date: still works

### TC-F13-66: Meet now and meeting links stay out of the calendar
- **Covers:** AC-F13-12
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.integration.test.ts`
- **Given** Meet now and Get a meeting link
- **When** both are used as in F02, then the calendar is read
- **Then** they work as before and are not in the calendar or the Upcoming list

### TC-F13-67: Calendar range and truncation
- **Covers:** AC-F13-01, AC-F13-11
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.integration.test.ts`
- **Given** a daily series with no end date and many more
- **When** the calendar is read for a day, a week, a 42-day month and a range beyond a year
- **Then** correct occurrences with `canJoin`; `truncated: true` over 500; nothing beyond a year

### TC-F13-68: Upcoming list on Meetings
- **Covers:** AC-F13-23
- **Level:** integration
- **File:** `apps/api/src/modules/meetings/meetings.upcoming.test.ts`
- **Given** scheduled meetings today, tomorrow, later, cancelled and declined
- **When** the list is read
- **Then** only today's and tomorrow's, in order, with the Join flag

### TC-F13-69: Invitee or organizer leaves the workspace
- **Covers:** AC-F13-29
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.leave.test.ts`
- **Given** an invitee, then the organizer with co-organizers present
- **When** each leaves the workspace
- **Then** the invitee no longer sees any of its meetings (404); the organizer's meetings stop (F02) and every invitee gets a cancellation email

### TC-F13-70: Privacy sweep
- **Covers:** AC-F13-30
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.sweep.test.ts`
- **Given** external invitees of a meeting cancelled 31 days ago, one cancelled 29 days ago, one expired 31 days ago, an active one, and the same address in two meetings
- **When** the daily sweep runs
- **Then** rows of the first and third are deleted, the others stay; the address of one meeting never shows in another's data

### TC-F13-71: No address in the queue
- **Covers:** AC-F13-30
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.mail.test.ts`
- **Given** an outside invitee and a paused email queue
- **When** the Send is made and Redis is read
- **Then** job data holds only invitee id and template, no address; the database holds only the encrypted value and hash

### TC-F13-72: Failed email and Retry
- **Covers:** AC-F13-31
- **Level:** integration
- **File:** `apps/api/src/modules/scheduling/scheduling.emails.integration.test.ts`
- **Given** a mail server that refuses one address
- **When** the queue uses its 5 tries, then the organizer reads the details and POSTs resend
- **Then** the meeting exists; that invitee is `failed`, others `sent`; resend re-queues only the failed ones; an invitee calling resend gets 403

### TC-F13-73: Injection and open relay
- **Covers:** AC-F13-28, AC-F13-27
- **Level:** security
- **File:** `apps/api/src/modules/scheduling/scheduling.emails.integration.test.ts`
- **Given** titles and descriptions with HTML, script, header-breaking newlines (`\r\nBcc:`), and `.ics` injection lines (`END:VEVENT`)
- **When** the meeting is created, emailed and read back
- **Then** text is returned unchanged and shown as text; no extra header, recipient or calendar line appears; mail goes only to the meeting's invitees

### TC-F13-74: Privacy sweep of the code and logs
- **Covers:** AC-F13-27, AC-F13-30
- **Level:** security
- **File:** `apps/api/src/modules/scheduling/scheduling.security.test.ts`
- **Given** a Send, an update and a cancel with outside addresses and the logger captured
- **When** logs and error bodies are read
- **Then** no email address, passcode or description appears in logs or errors

### TC-F13-75: Schedule, invitee sees it live, answers, organizer sees it
- **Covers:** AC-F13-01, AC-F13-04, AC-F13-09, AC-F13-16, AC-F13-17
- **Level:** desktop
- **File:** `tests/e2e/desktop/calendar.spec.ts`
- **Given** two windows, A and B in one workspace
- **When** A presses New meeting, fills a title, invites B and presses Send; B accepts, then declines, from the details
- **Then** B's Calendar shows the block and an invite card without reload; the details show A as organizer; A sees B's answer within 5 seconds

### TC-F13-76: Drag on empty time, Upcoming card and Join
- **Covers:** AC-F13-03, AC-F13-07, AC-F13-23
- **Level:** desktop
- **File:** `tests/e2e/desktop/calendar.spec.ts`
- **Given** A with the calendar open and a meeting starting in 3 minutes
- **When** A drags across empty time, checks the form's times, cancels; then opens Meetings
- **Then** the form had the dragged range; Meetings lists today's meeting with Join; Join opens the pre-join and the meeting works as in F02

### TC-F13-77: Repeat, edit one occurrence, edit the series, cancel
- **Covers:** AC-F13-11, AC-F13-18, AC-F13-19
- **Level:** desktop
- **File:** `tests/e2e/desktop/calendar.spec.ts`
- **Given** A with a weekly Mon+Wed series with B invited
- **When** A edits one occurrence's time, then the series time (warning), then cancels the series
- **Then** B sees each change live; the series time change resets B's answer; after cancel it leaves both calendars and the link gives "expired"

### TC-F13-78: Reminder card with Join and Snooze
- **Covers:** AC-F13-21
- **Level:** desktop
- **File:** `tests/e2e/desktop/calendar.spec.ts`
- **Given** B accepted a meeting starting in 15 minutes (fake clock), two windows open
- **When** the reminder is due; B presses Snooze in one window, later Join
- **Then** one card appears per person, closes in the other window on Snooze, returns after 5 minutes, and Join opens the pre-join; a declined meeting gives none

### TC-F13-79: Keyboard only and accessibility
- **Covers:** AC-F13-07, AC-F13-24
- **Level:** desktop
- **File:** `tests/e2e/desktop/calendar.spec.ts`
- **Given** the Calendar screen
- **When** a person schedules a meeting using only the keyboard; axe runs on the calendar, form and details
- **Then** the meeting is created; there are no axe errors; focus is visible and in order

### TC-F13-80: Description link opens the browser
- **Covers:** AC-F13-28
- **Level:** desktop
- **File:** `tests/e2e/desktop/calendar.spec.ts`
- **Given** a meeting whose description has `<script>` text and a link
- **When** B opens the details and clicks the link
- **Then** the text shows as text; the link opens in the normal browser, not in the app

### TC-F13-81: Views, time zone, empty hint and declined style
- **Covers:** AC-F13-01, AC-F13-02, AC-F13-05, AC-F13-06
- **Level:** desktop
- **File:** `tests/e2e/desktop/calendar.spec.ts`
- **Given** the computer in a set time zone, 24-hour, with meetings, one declined
- **When** Calendar is opened, views switched, workspace switched and an empty week visited
- **Then** times follow the zone and the hour setting; red line is in today; the declined block is dimmed and struck through; the empty hint shows

### TC-F13-82: Offline calendar
- **Covers:** AC-F13-32
- **Level:** desktop
- **File:** `tests/e2e/desktop/calendar.spec.ts`
- **Given** a loaded calendar
- **When** the network is cut
- **Then** the data stays with the offline notice; Send, Send update, Cancel and answers are disabled

## Coverage

| AC | Test cases |
|---|---|
| AC-F13-01 | TC-F13-16, TC-F13-18, TC-F13-19, TC-F13-20, TC-F13-67, TC-F13-75, TC-F13-81 |
| AC-F13-02 | TC-F13-03, TC-F13-17, TC-F13-21, TC-F13-43, TC-F13-81 |
| AC-F13-03 | TC-F13-22, TC-F13-76 |
| AC-F13-04 | TC-F13-24, TC-F13-61, TC-F13-75 |
| AC-F13-05 | TC-F13-25, TC-F13-81 |
| AC-F13-06 | TC-F13-23, TC-F13-81 |
| AC-F13-07 | TC-F13-10, TC-F13-14, TC-F13-26, TC-F13-27, TC-F13-76, TC-F13-79 |
| AC-F13-08 | TC-F13-10, TC-F13-28 |
| AC-F13-09 | TC-F13-47, TC-F13-75 |
| AC-F13-10 | TC-F13-10, TC-F13-11, TC-F13-29, TC-F13-48 |
| AC-F13-11 | TC-F13-01, TC-F13-02, TC-F13-03, TC-F13-04, TC-F13-30, TC-F13-67, TC-F13-77 |
| AC-F13-12 | TC-F13-66 |
| AC-F13-13 | TC-F13-05, TC-F13-47, TC-F13-64, TC-F13-65 |
| AC-F13-14 | TC-F13-31, TC-F13-49 |
| AC-F13-15 | TC-F13-06, TC-F13-52 |
| AC-F13-16 | TC-F13-32, TC-F13-53, TC-F13-75 |
| AC-F13-17 | TC-F13-37, TC-F13-54, TC-F13-75 |
| AC-F13-18 | TC-F13-06, TC-F13-07, TC-F13-33, TC-F13-55, TC-F13-77 |
| AC-F13-19 | TC-F13-07, TC-F13-08, TC-F13-34, TC-F13-56, TC-F13-77 |
| AC-F13-20 | TC-F13-12, TC-F13-35, TC-F13-57 |
| AC-F13-21 | TC-F13-13, TC-F13-14, TC-F13-15, TC-F13-36, TC-F13-37, TC-F13-62, TC-F13-78 |
| AC-F13-22 | TC-F13-13, TC-F13-62, TC-F13-63 |
| AC-F13-23 | TC-F13-38, TC-F13-68, TC-F13-76 |
| AC-F13-24 | TC-F13-23, TC-F13-41, TC-F13-46, TC-F13-79 |
| AC-F13-25 | TC-F13-17, TC-F13-42, TC-F13-43 |
| AC-F13-26 | TC-F13-12, TC-F13-45, TC-F13-57, TC-F13-58, TC-F13-59, TC-F13-60 |
| AC-F13-27 | TC-F13-31, TC-F13-45, TC-F13-50, TC-F13-51, TC-F13-59, TC-F13-73, TC-F13-74 |
| AC-F13-28 | TC-F13-09, TC-F13-44, TC-F13-73, TC-F13-80 |
| AC-F13-29 | TC-F13-69 |
| AC-F13-30 | TC-F13-52, TC-F13-70, TC-F13-71, TC-F13-74 |
| AC-F13-31 | TC-F13-39, TC-F13-72 |
| AC-F13-32 | TC-F13-40, TC-F13-82 |
