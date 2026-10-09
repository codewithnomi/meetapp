---
status: draft
updated: 2026-10-09
---

# Security Rules (Baseline)

Rules every feature must follow. The `security-auditor` helper checks code against this list.
Every feature's requirements must include a "Security & privacy" section.

## Accounts & access
- S1. Every request is checked **on the server**: is this user logged in, and allowed to see or do this?
- S2. Workspaces are fully separated. A user never sees another workspace's meetings, chats, transcripts or AI answers.
- S3. Meeting links are long and random (not guessable). Hosts can lock a meeting or use a waiting room.
- S4. Call-server (LiveKit) tokens are valid for one meeting only, with minimum rights and a short lifetime.
- S5. Rate limits on login, sign-up, meeting creation and AI questions.

## Data
- S6. All traffic is encrypted (HTTPS/WSS; calls use encrypted WebRTC).
- S7. Secrets (API keys, passwords) live only in environment files or a secrets manager, never in code or the app.
- S8. Third-party tokens (Jira, Google, etc.) are stored encrypted.
- S9. Workspace admins can delete meetings and transcripts; deletion also removes the AI search data.
- S10. Logs never contain transcripts, messages, passwords or tokens.

## Input
- S11. All input is validated (length, type, format). Chat messages and names are shown as plain text (no HTML/scripts).
- S12. File uploads: allowed types only, size limit, stored privately, never executed.

## AI-specific
- S13. AI search only uses meetings the asking user is allowed to see (permission filter in the database query).
- S14. Transcript and chat text is treated as **data, not instructions**. If someone says "ignore your instructions" in a meeting, the AI must not obey it.
- S15. AI actions in other tools (create ticket, send message) always need the user's confirmation click.
- S16. Only the minimum necessary data is sent to AI services.

## Desktop app (Electron)
- S17. Context isolation on, Node integration off, sandbox on.
- S18. Auto-updates are signed and verified.

## Code & dependencies
- S19. Dependency vulnerability scan on every feature verification; no known Critical/High issues at release.
- S20. Secrets scan on every feature verification.
