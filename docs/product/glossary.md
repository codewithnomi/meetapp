# Glossary

Words used in MeetApp's documents and code, in plain English.

| Term | Meaning |
|---|---|
| **Workspace** | A company or team space. Members, meetings and data belong to it. Every user also has a personal workspace. |
| **Member / Owner / Admin** | Roles inside a workspace. The owner created it; admins manage it; members use it. |
| **Guest** | Someone who joins a meeting by link, or meeting ID and passcode, without an account. Shown as "(Guest)". |
| **External person** | Someone signed in to MeetApp who isn't in the meeting's workspace. Shown as "(External)". |
| **Meeting** | One call (scheduled or instant), with its participants, chat, transcript and minutes. |
| **Host** | Old word for the people running a meeting; since F02 see Organizer and Co-organizer. |
| **Organizer** | The person who created a meeting; has all its controls. |
| **Co-organizer** | A workspace member the organizer gave almost all the organizer's controls (up to 10 per meeting). |
| **Presenter** | Can share their screen and help run a meeting (let people in, mute, remove). By default everyone joins as a presenter. |
| **Attendee** | Can talk, show video, raise a hand and react, but not share or manage others. |
| **Lobby** | Where people wait until someone in the meeting lets them in (the "waiting room"). |
| **Meeting ID and passcode** | A 12-digit number and a 6-character code that lead to a meeting, as an alternative to its link. |
| **Participant** | Anyone in a meeting. |
| **Meet now** | Starting a meeting straight away, without planning it. |
| **Attendance** | One person's single visit to a call, from the lobby to leaving (`call_attendances`); a Rejoin makes a new one. |
| **Meeting ticket** | The secret the app gets when it asks to join; it proves which attendance is asking (sent as `X-Meeting-Ticket`, only its fingerprint is stored). |
| **Call pass** | The short-lived permission (10 minutes) the backend gives the app to connect to the call server for one call, with that person's rights. |
| **Meeting link** | A web address that leads to one meeting; anyone with it can ask to join (people outside the workspace wait in the lobby). |
| **Allow guests** | A workspace setting (owner and admins, in Workspace settings): when off, people without an account can't join the workspace's meetings. |
| **Pin** | Keeping one person large on your own screen; others don't see it. |
| **Load test** | A test that fills a meeting with simulated people to check speed and memory (`pnpm test:load`). |
| **Track** | One stream of audio or video from one participant (e.g. "Ali's microphone"). |
| **Transcript** | The written text of everything said in a meeting. |
| **Segment** | One line of the transcript: who spoke, when, and what they said. |
| **Caption** | A transcript line shown live during the meeting. |
| **Minutes** | The AI-written summary after a meeting: summary, decisions, action items, open questions. |
| **Action item** | A task from a meeting: who does what, by when. |
| **Ask AI** | Chatting with the AI about past meetings. |
| **Chunk** | A small piece of a transcript (~1 minute) stored for AI search. |
| **Embedding** | A "meaning fingerprint" of a chunk, so the AI can find text with similar meaning. |
| **Persona** | A user's description of themselves and their work, used to personalize AI. |
| **Integration / MCP** | A connection to another tool (Jira, Slack…) the AI can use, always with user confirmation. |
| **Spec** | The documents for a feature: requirements, design, tests, tasks, verification. |
| **AC (acceptance criterion)** | One checkable promise in a spec, e.g. `AC-F02-03`. |
| **TC (test case)** | One test that proves an AC, e.g. `TC-F02-07`. |
| **Token (design)** | A named design value (color, spacing) used instead of fixed values, so themes work. |
| **SFU / call server** | The server (LiveKit) that passes audio/video between participants. |
| **TURN** | A relay that keeps calls working when company firewalls block direct connections. |
| **Feature flag** | An on/off switch to enable a feature for some users before everyone. |
