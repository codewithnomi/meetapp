---
status: draft
updated: 2026-10-20
---

# Privacy & Legal Requirements

> Not legal advice. Before launch, a lawyer must review the privacy policy, terms of service and data processing agreement.

## 1. Consent for transcription and recording
- In many countries and US states, **everyone** in a call must be informed (and sometimes agree) before it's recorded or transcribed.
- Therefore:
  - A clear, always-visible indicator ("Transcription on") for **all** participants.
  - A notice when joining a meeting where AI is on.
  - Only the host (or a workspace setting) can turn AI on/off.
  - Each participant's consent/notice is logged.

## 2. User rights (GDPR and similar laws)
- **Export:** a user can download their data (profile, transcripts of their speech, chats).
- **Delete:** a user can delete their account; their data (including AI search data) is removed within 30 days.
- **Retention:** workspace admins choose how long transcripts/minutes are kept (e.g. 30 days, 1 year, forever). Expired data is deleted automatically, including AI search data.
- **Data location:** record which country each provider stores data in. EU data residency is a later option for business customers.

### What accounts and workspaces store (F01)
| Data | Kept as | How long |
|---|---|---|
| Name, email, terms version and date, "16 or older" confirmation, theme, accent, last-used workspace | plain fields | while the account exists |
| Password | scrypt hash only | while the account exists |
| Profile photo | re-encoded 512×512 WebP in private storage, location and camera details removed; seen only by people who share a workspace. A Google/Microsoft photo is copied once at the first sign-in, then their address is forgotten | until replaced or removed (the old file is deleted) |
| Sign-ups waiting for their code | name, email and password hash in Redis (the code only as a hash) | at most 30 minutes |
| Sign-in sessions | SHA-256 fingerprint of the token | 30 days, extended by use |
| Email codes (sign-up, sign-in, reset) | hash only | 15 minutes |
| Google/Microsoft sign-in tokens | encrypted | while the login is linked |
| Workspace memberships and roles; removal history (for the "removed earlier" badge) | plain fields | while the workspace exists |
| Invitations (invited email, role, who invited) | the link's token only as a SHA-256 hash | pending 7 days; the record stays as history |
| Join link and code | encrypted (AES-256-GCM), found through a keyed hash | until switched off or replaced |
| Requests to join | plain fields | waiting up to 14 days, then expired |
| Attempt counters (wrong passwords, codes sent, sign-ups) | in Redis under a keyed hash of the email or address | 15 minutes to 24 hours |

### What meetings and calls store (F02)
| Data | Kept as | How long |
|---|---|---|
| Meetings: title, organizer, options, co-organizers, 12-digit meeting ID | plain fields | until the meeting expires (60 days; for link meetings, 60 days after the last join or change); deleting expired meetings comes with F06/F10 (S9) |
| Meeting link and passcode | encrypted (AES-256-GCM), found through a keyed hash (HMAC) | as the meeting |
| Meeting record: who took part (name shown, member / external / guest), when each joined and left, how the call ended | plain fields; a deleted account's link is removed and only the name stays | how long comes with F06/F10 (S9) |
| Meeting chat (F03): messages and shared files | text in the database, files in private storage, pictures without location or camera details; seen only by people allowed in that meeting | deleted with the meeting; a deleted account's text and files removed within 30 days |
| Guests: the name they typed | plain field, shown as text only | as the meeting record |
| Guests' "same app" fingerprint (to keep a removed guest out of the call) | HMAC of the meeting ID and a random key made on their computer, so one guest's meetings can't be linked | as the meeting record |
| Meeting tickets (the in-meeting pass) | SHA-256 fingerprint only, on the attendance; the app keeps the ticket in memory | works until the person leaves (30 minutes more for reading the outcome); the fingerprint stays with the meeting record |
| Call-server reports already handled | report ID and time | 1 day |
| Audio, video and screen shares | **never stored**: passed between people by the call server only | — |

The computer's camera, microphone and screen are used only while a person chooses to (pre-join preview, call, sharing). The app remembers the chosen devices on that computer only. Logs and traces never contain meeting links, passcodes, tickets, call passes or guest names (tested: TC-F02-108, 109).

Until export and deletion are built into the app, people ask through `SUPPORT_EMAIL` (shown in Settings → Profile and account → "Your data"), and we reply within 30 days. Logs never contain passwords, codes, tokens, invitation or join links, or request bodies (tested: TC-F01-81, 82).

## 3. Third-party services ("sub-processors")
A public list of every service that touches user data, and why:
LiveKit Cloud (development only; self-hosted in production), Google and Microsoft (optional sign-in only: they receive the sign-in request and send us the name, verified email and, once, the profile photo), the GIF service for meeting chat (F03, KLIPY, contacted by each person's app: the GIF search words, a random per-meeting id, and the internet address of people searching for or seeing GIFs; admins can turn GIFs off), Deepgram (speech-to-text), Anthropic (AI), embedding provider, Sentry (errors), cloud hosting, email provider, payment provider.
- Use only providers that **don't train on our customers' data** and offer a data processing agreement.
- **Local monitoring (F00, on the developer's Mac only):** the backend's logs and traces and the MeetApp containers' logs are kept for 7 days in Loki and Tempo on that Mac, never sent to a third party. Secrets and personal data are removed before logging (security rule S10); database error details and secrets in web addresses are removed too (F00 T-fix-2). The cleaning works on patterns, so an unusual secret format could still get through. (Confirmed by the owner on 2026-10-11.)

## 4. Documents needed before launch
Privacy Policy · Terms of Service · Data Processing Agreement (for companies) · Cookie policy (web) · Acceptable Use Policy · Sub-processor list.

## 5. Other
- Minimum age: 16 (or as required by local law).
- Security contact (`security@…`) for people reporting vulnerabilities.
- Later, for big companies: SOC 2 / ISO 27001 certification. Our documentation habits make this much easier.
