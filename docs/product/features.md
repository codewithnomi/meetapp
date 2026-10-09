---
status: draft
updated: 2026-10-09
---

# MeetApp: Complete Feature Plan

This is the full plan of **everything the app will do** and **the order we build it in**.
Each feature has an ID (F00, F01…). Each one gets its own detailed spec in `docs/specs/` before any code is written.

## How every feature is built (same 5 steps each time)
| Step | What happens | Your part |
|---|---|---|
| 1. Requirements | Claude writes **what** the feature does as a list of checkable promises | Answer a few questions, say "approved" |
| 2. Design | Claude writes **how** it will work (screens, data, security) | Read the short summary, say "approved" |
| 3. Tests + steps | Claude writes the test cases, then small build steps | Say "approved" |
| 4. Build | After your **"go ahead"**: one step at a time, tests first, all tests re-run each time | Try it when Claude says it's ready |
| 5. Verify | Automatic: all tests, every promise, security, code quality, UI and docs | Read the result. ✅ = done |

You only ever need to type **`/next`**.

---

## Phase 0: Foundation
*Result: the base everything else stands on. You can open an empty desktop app window, switch themes, and see the design pieces.*

### F00 Foundation
- One command starts everything on your Mac
- Light / dark / system theme + 8 accent colors (sky blue default)
- Gallery of basic UI pieces (buttons, inputs, avatars, icons…)
- Automatic tests, code-quality rules, security scans, GitHub checks
- Error tracking (optional, free), feature flags, getting-started guide
- **Depends on:** nothing · **Size:** medium

---

## Phase 1: A working meeting app (desktop)
*Result: you and others can sign in, start or schedule a meeting, and talk with audio, video, screen share and chat, from the desktop app.*

### F01 Accounts & workspaces
- Sign up / sign in with **email, Google or Microsoft**
- Email verification, forgot password, sign out everywhere
- Every user gets a **personal space**; companies create a **workspace** and invite teammates by email or link
- Roles: owner, admin, member
- Profile: name, photo, theme and color choice (saved to the account)
- **Depends on:** F00 · **Size:** large

### F02 Meetings & calling
- **Start now** or get a meeting link to share; join by link or code
- Pre-join screen: check camera, mic and speakers; pick devices; join muted
- Audio + video for up to **100 people**; grid view, speaker view, pin someone
- **Screen sharing** (whole screen or one window)
- Mute / camera off, raise hand, emoji reactions, who's-speaking highlight
- **Host controls:** waiting room, admit/deny, mute others, remove someone, lock meeting, end for all
- Guests without an account can join by link (if the host allows)
- Noise suppression, automatic reconnect on bad network, connection-quality indicator
- **Depends on:** F01 · **Size:** large

### F03 In-meeting chat
- Text chat for everyone in the meeting, plus private messages to one person
- Send files and images (size limit, safe file types only)
- Chat saved with the meeting afterwards
- **Depends on:** F02 · **Size:** small

### F04 Desktop app
- Installable app for **Mac and Windows** (unsigned for now, D017)
- Clicking a meeting link opens the desktop app (`meetapp://` links)
- Desktop notifications (meeting starting, someone's waiting, mentions)
- Remembers window size; runs smoothly in the background during calls
- Auto-update (ready, turned on when we go online)
- **Depends on:** F02 · **Size:** medium

### F13 Scheduling & calendar
- Schedule a meeting for a date and time (one-off or repeating)
- Invite people by email; they get a calendar invite (works with Google Calendar, Outlook, Apple Calendar)
- Upcoming meetings list on the home screen, with reminders
- Later: two-way sync with Google/Outlook calendars
- **Depends on:** F01, F02 · **Size:** medium

---

## Phase 2: AI notes
*Result: every meeting gets live captions with names, and a clean set of minutes afterwards.*

### F05 Live transcription
- Host turns AI notes on/off; **everyone sees a clear "Transcription on" notice** (legal requirement)
- Live captions with the speaker's name, under 2 seconds delay
- Full transcript saved after the meeting, each line with name and time
- Project and product names spelled correctly (uses persona keywords later in F08)
- After the meeting, a higher-accuracy clean-up pass of the transcript
- **Depends on:** F02 · **Size:** large

### F06 Minutes & meeting library
- After the meeting: **summary, key topics, decisions, action items (who, what, by when), open questions**
- Minutes emailed to participants (optional)
- **Meetings library:** all past meetings with minutes, transcript, chat and participants; search by title, date or person
- Edit minutes; share with people who weren't there
- **Depends on:** F05 · **Size:** medium

---

## Phase 3: AI assistant
*Result: you can ask questions about any meeting you had, the AI knows your context, and action items become tickets in one click.*

### F07 Ask AI
- Chat with the AI about your past meetings: *"Has anyone discussed the deployment date for feature XYZ?"*
- Every answer shows its **sources**: which meeting, who said it, at what time. Click to jump there
- Says "I couldn't find that" instead of inventing answers
- Only searches meetings you're allowed to see
- Ask about one meeting or all of them; filter by date or person
- **Depends on:** F06 · **Size:** large

### F08 Persona
- Describe yourself: company, role, projects, product ("I'm a full-stack developer at Aria working on…")
- Workspace-level company description shared by everyone in the company
- AI uses it to personalize minutes ("what matters to me") and answers
- Improves transcript spelling of your project names
- **Depends on:** F07 · **Size:** small

### F09 Integrations (MCP)
- Connect tools: **Jira, Linear, GitHub, Slack, Notion** (more later)
- **Create a ticket from an action item in one click.** The AI fills it in, and you confirm before it's sent
- Ask AI can use connected tools ("create tickets for all my action items from today")
- Disconnect anytime; connection details stored encrypted
- **Depends on:** F06, F07 · **Size:** large

---

## Phase 4: More platforms & business
*Result: MeetApp works in the browser and on phones, can take payments, and can run AI privately.*

### F10 Web app, billing & admin
- Full app in the **browser** (same features as desktop)
- **Free and paid plans**, payments, invoices
- **Admin console:** members, roles, AI settings, data retention (how long transcripts are kept), usage
- Data export and account deletion (privacy law)
- **Depends on:** F01–F09 · **Size:** large

### F11 Mobile app (Flutter)
- iPhone and Android, **same look on both**
- Join and host calls, chat, see minutes, Ask AI
- Push notifications; "Sign in with Apple" added (App Store rule)
- **Depends on:** F10 · **Size:** large

### F12 Local AI mode
- Option to run transcription (Whisper) and AI (Ollama) **on your own computer**: private and free
- Choose at install or in settings; the app is honest that local AI is less accurate
- **Depends on:** F05–F07 · **Size:** medium

---

## Later ideas (not planned yet)
Meeting **recording** (video files) · background blur / virtual backgrounds · breakout rooms · permanent team chat channels · live translation · whiteboard · end-to-end encryption · webinars · Linux desktop app.

## The build order at a glance
```
F00 → F01 → F02 → F03 → F04 → F13      (Phase 1: working meeting app)
    → F05 → F06                        (Phase 2: AI notes)
    → F07 → F08 → F09                  (Phase 3: AI assistant)
    → F10 → F11 → F12                  (Phase 4: web, mobile, business, local AI)
```
F13 (scheduling) has a higher number only because it was added later. It's built in Phase 1. Build order follows `docs/specs/INDEX.md` from top to bottom.
