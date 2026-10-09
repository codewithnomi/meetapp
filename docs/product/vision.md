---
status: draft
updated: 2026-10-09
---

# Product Vision

## In one sentence
A meeting app like Microsoft Teams or Zoom that is **cheaper**, has **excellent call quality even with 100 people**, and has a **smart AI assistant** built in that remembers what was said in meetings.

## Who it is for
- **Companies and teams** (main focus): workspaces, admins, company login.
- **Individuals**: anyone can sign up and invite others. Free plan plus paid plans.

## Platforms (in this order)
1. **Desktop app**: Mac and Windows first, Linux later.
2. **Web browser**: same features, no install.
3. **Mobile app**: iPhone and Android (built with Flutter, so it looks the same on both).

## What makes us different
| Normal meeting apps | MeetApp |
|---|---|
| Expensive per user | Cheaper (we run our own call servers) |
| AI notes are an extra add-on | AI notes included |
| Speaker names in transcripts are often wrong | Every line has the **correct** speaker name (each person's microphone is transcribed separately) |
| You can only search one meeting | **Ask AI across all your meetings**: "Has anyone discussed the deployment date for feature XYZ?" |
| AI doesn't know who you are | **Persona**: the AI knows your company, role and projects, and answers accordingly |
| Notes stay in the app | **One-click actions**: turn an action item into a Jira/Linear ticket |
| Cloud only | Option to run the AI **locally on your own computer** for privacy |

## The main things a user can do
1. Sign up, create or join a workspace (company).
2. Start or join an audio/video meeting with up to 100 people (share screen, chat, mute, etc.).
3. See live captions with names during the meeting.
4. After the meeting, get **minutes**: summary, decisions, action items with owners and dates.
5. Ask the AI questions about any past meeting they had access to.
6. Set up their persona ("I work at Aria as a full-stack developer on projects A and B…").
7. Connect tools (MCP), e.g. Jira, and create tickets from action items in one click.

## Quality goals
- **Calls:** clear audio and smooth video with 100 participants; low delay.
- **Transcripts:** must be outstanding, because every AI feature depends on them.
- **AI answers:** must show where the answer came from (which meeting, who said it, at what time).

## Not doing (for now)
- Webinars with thousands of viewers
- Phone dial-in
- Our own email/calendar product (we'll connect to Google/Outlook calendars instead)
