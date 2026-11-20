---
feature: F13
title: Scheduling & calendar
status: draft
updated: 2026-11-20
---

# F13 Scheduling & calendar: Requirements (WHAT)

## Goal
People plan meetings ahead, as in Microsoft Teams: pick a date and time, invite people (also from outside, by email, with a calendar invite for Google Calendar, Outlook or Apple Calendar), see what's coming up in a calendar, get a reminder, and join with one click.

## Who uses it
- **Workspace members:** schedule meetings, are invited, answer invites, see their calendar.
- **People outside the workspace:** receive an emailed invite with the link and a calendar file; they join as external people or guests (F02 rules).
- **Organizer and co-organizers (F02):** edit or cancel a scheduled meeting.

## User stories
- As a member, I want to schedule a meeting for a date and time, so that everyone can plan for it.
- As a member, I want a weekly or daily repeating meeting, so that I don't create the same meeting again and again.
- As an organizer, I want invitees to get a calendar invite by email, so that the meeting shows in whatever calendar they use.
- As an invitee, I want to say Accept, Tentative or Decline, so that the organizer knows who's coming.
- As a member, I want a calendar of my meetings and a reminder before each one, so that I don't miss any.
- As an organizer, I want to change or cancel a meeting, and everyone is told.

## Acceptance criteria

### Calendar
- **AC-F13-01:** WHEN a signed-in member opens **Calendar** in the side menu, THEN they see a work week (Monday–Friday) of the open workspace's meetings they organize or are invited to, with each meeting as a block at its time showing its title and organizer. They can switch to **Day**, **Week** and **Month**, move back and forward, and press **Today**. The calendar shows only the open workspace; switching workspace switches it. Meetings at the same time show side by side, up to 4, then "+N more".
- **AC-F13-02:** WHEN the calendar shows, THEN times are in the computer's time zone and its 12/24-hour setting; a red line marks the current time in today's column.
- **AC-F13-03:** WHEN a meeting is happening now or starts within 5 minutes, THEN its block shows a **Join** button that opens that meeting's (or occurrence's) pre-join (F02). The same Join appears on the meeting's details.
- **AC-F13-04:** WHEN the person clicks a meeting block, THEN its details show: title, date and time, repeat, organizer, invitees with their answers (Accepted, Tentative, Declined, No answer), the description, the link, ID and passcode, and Join, Chat (F03's meeting chat, open to invited members before the meeting as in Teams), and for invitees their answer buttons.
- **AC-F13-05:** WHEN the person has no meetings in the shown period, THEN the calendar is empty with a hint "No meetings. Select New meeting to schedule one."
- **AC-F13-06:** WHEN the person's answer is Declined, THEN the meeting still shows, dimmed and struck through, as in Teams.

### Scheduling
- **AC-F13-07:** WHEN the member presses **New meeting** in Calendar (or drags across empty time in the calendar, which fills start and end with the dragged range), THEN a form opens with: title (required, up to 100 characters), invitees, start date and time, end date and time (default: the next half hour, 30 minutes long), all day, repeat, and description (up to 2,000 characters). WHEN **All day** is on, THEN the time fields hide and the meeting spans the whole day in the organizer's time zone; Join and reminders work as for any meeting (reminder 15 minutes before 00:00 is not shown; one shows at 09:00).
- **AC-F13-08:** WHEN the member types in invitees, THEN workspace members are suggested by name or email; any valid email address can also be added (an external person). At most 250 invitees; above 100 the form notes that a meeting holds 100 people at once (F02).
- **AC-F13-09:** WHEN the member presses **Send** with valid fields, THEN the meeting is created in the open workspace with them as organizer, it shows in their calendar and every invited member's calendar within 5 seconds, and every invitee is emailed an invite (AC-F13-15).
- **AC-F13-10:** WHEN a field is wrong (no title, end not after start, start more than 5 minutes in the past, a bad email), THEN Send is refused and the field says what is wrong; nothing is created or sent.
- **AC-F13-11:** WHEN the member chooses a repeat, THEN the choices are: Does not repeat, Every weekday (Mon–Fri), Daily, Weekly (on chosen days), Monthly (same date), Yearly, with an optional end date (no end date by default). A series is one rule; the calendar shows its occurrences up to 1 year ahead. Monthly on the 29th–31st falls on the month's last day when the month is shorter. Each occurrence appears in the calendar and uses the same link, ID and passcode.
- **AC-F13-12:** WHEN the member chooses **Meet now** or **Get a meeting link** (F02), THEN those work unchanged from F02 and don't show in the calendar.
- **AC-F13-13:** WHEN a scheduled meeting is in use, THEN all F02 rules apply to it (lobby, roles, organizer = the person who scheduled it, limits). A scheduled meeting's link stops working 60 days after its last occurrence ends; a series with no end date keeps working while it repeats (F02's AC-F02-04 gains this case, decision D093).
- **AC-F13-14:** WHEN a member schedules meetings, THEN they can create at most 50 an hour (the same limit as F02), and are told how long to wait.

### Invites and answers
- **AC-F13-15:** WHEN an invite is sent, THEN each invitee gets an email with the title, date and time (with time zone), organizer, description, the **Join** link, meeting ID and passcode, and a calendar file that Google Calendar, Outlook and Apple Calendar can add in one click (repeats included).
- **AC-F13-16:** WHEN an invited member answers **Accept**, **Tentative** or **Decline** (in the meeting's details, for the whole series or one occurrence), THEN the organizer sees the answer within 5 seconds. An external person's answer from their own calendar app is not tracked (shows "No answer").
- **AC-F13-17:** WHEN a member is invited, THEN they also get a MeetApp notification (F04's notifications, can be turned off in Settings) "<Organizer> invited you to <title>".

### Changing and cancelling
- **AC-F13-18:** WHEN the organizer or a co-organizer changes the title, time, repeat, invitees or description and presses **Send update**, THEN everyone's calendar shows the change within 5 seconds, and invitees are emailed the update with an updated calendar file. Removed invitees are emailed a cancellation; added ones a new invite. For a repeating meeting, they choose **This occurrence** or **The whole series**. Changing the whole series' time, after a warning, resets everyone's answers to No answer and drops changes made to single occurrences.
- **AC-F13-19:** WHEN the organizer cancels the meeting (one occurrence or the series), optionally with a message, THEN it leaves every calendar, invitees are emailed a cancellation that removes it from their calendar app, and its link stops working (for the series) or that occurrence is skipped.
- **AC-F13-20:** WHEN anyone else (not organizer or co-organizer) opens the meeting, THEN they cannot edit or cancel it; the server refuses it too.

### Reminders
- **AC-F13-21:** WHEN a meeting the person accepted, answered tentative, or hasn't answered starts in 15 minutes (and again at its start time), THEN MeetApp shows a reminder notification with the title and a **Join** button, as in Teams, with **Dismiss** and **Snooze** (5 minutes); it shows once per person even with several windows open, and also while MeetApp runs in the menu bar; a declined or cancelled meeting gives none. Reminders follow F04's notification settings and Do not disturb.
- **AC-F13-22:** WHEN MeetApp was closed and opens later, THEN no reminder shows for meetings that have already ended.

### Problems
- **AC-F13-31:** WHEN some invite emails cannot be sent, THEN the meeting still exists and the organizer sees "Some invites couldn't be sent" with **Retry**.
- **AC-F13-32:** WHEN there's no connection, THEN the calendar shows what it last loaded with an offline notice, and Send, Send update, Cancel and the answer buttons are disabled.

### Home and Meetings
- **AC-F13-23:** WHEN the member opens **Meetings** (F02), THEN it lists their next scheduled meetings for today and tomorrow (title, time, Join when AC-F13-03 allows), with "View calendar".

### Accessibility and languages
- **AC-F13-24:** WHEN the calendar and the form are used with the keyboard or a screen reader, THEN every block, button and field can be reached and used, each meeting block reads its title, time and the person's answer, and contrast meets WCAG 2.2 AA.
- **AC-F13-25:** WHEN the new screens are used, THEN every text comes from the translation file, and dates and times follow the computer's language and region.

## Security & privacy
- **AC-F13-26 (S2):** WHEN someone asks for a meeting's details, invitees or answers, THEN only the workspace's members who organize or are invited to it get them; everyone else gets "not found", revealing nothing. Invited members see the other invitees' names and answers. External invitees see the meeting only through their email and its link (the F02 pre-join), not in the app's calendar.
- **AC-F13-27 (S5):** WHEN invite emails are sent, THEN one person can send at most 1,000 meeting emails an hour (invites, updates and cancellations count). If a Send would go over, it is refused before anything is created or changed, with how long to wait. Emails go only through the app's mail service; external invitees' email addresses are shown only to the organizer and co-organizers.
- **AC-F13-28:** WHEN a description or title is shown (app or email), THEN it is shown as plain text (no scripts or hidden HTML); links in the description are clickable but open in the normal browser.
- **AC-F13-29:** WHEN an invited member leaves the workspace, THEN they no longer see its meetings; an organizer who leaves: their meetings stop working even if co-organizers remain (F02 AC-F02-07, unchanged) and invitees are emailed a cancellation.
- **AC-F13-30:** WHEN a meeting is cancelled or has expired, THEN its external invitees' email addresses are deleted within 30 days (privacy-legal.md); an external person's address appears in no other meeting's data. Invite emails carry a short footer naming who invited them and why they got it.

## Out of scope
- Meeting options (lobby, presenters, co-organizers) are set as in F02, from the meeting's details or during the meeting; recording and transcript settings come with F05+.
- Forwarding an invite, and turning off answers.
- Two-way sync with Google or Outlook calendars (later; features.md F13 "Later").
- Scheduling Assistant (seeing others' free/busy times), rooms and resources, webinars, channel meetings.
- Answers from external people's calendar apps (tracked later with the sync).
- Time zone choice per meeting (always the organizer's computer time zone, sent with the time).

## Open questions
None.
