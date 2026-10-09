---
status: draft
updated: 2026-10-09
---

# How the System Is Built (Overview)

Plain-English version first, technical names in brackets.

## The big pieces
```
 ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
 │  Desktop app  │   │   Web app     │   │  Mobile app   │   ← what users see
 │  (Electron)   │   │   (React)     │   │   (Flutter)   │
 └──────┬────────┘   └──────┬────────┘   └──────┬────────┘
        │  audio/video       │                   │
        ▼                    ▼                   ▼
 ┌──────────────────────────────────────────────────────┐
 │  Call server (LiveKit): passes audio/video between    │
 │  people. Handles 100-person meetings.                 │
 └──────────────────────────┬───────────────────────────┘
                            │ each person's audio, separately
                            ▼
 ┌──────────────────────────────────────────────────────┐
 │  AI worker (Python): turns speech into text with the  │
 │  speaker's name, writes minutes, prepares search data │
 └──────────────────────────┬───────────────────────────┘
                            ▼
 ┌──────────────────────────────────────────────────────┐
 │  Backend (Node.js + Fastify): accounts, workspaces,   │
 │  meetings, Ask AI, integrations                        │
 │  Database (PostgreSQL + pgvector): everything stored  │
 │  in one place, including AI search data                │
 └──────────────────────────────────────────────────────┘
```

## Technology choices (reasons in `decisions.md`)
| Part | Technology | Simple reason |
|---|---|---|
| Programming language | TypeScript (desktop, web, backend), Dart (mobile), Python (AI) | Best tool for each part |
| Desktop app | Electron | Uses the same calling engine as Google Chrome, so it's reliable |
| Web app | React | Same code as the desktop app |
| Design tokens | One shared color/spacing file → CSS for desktop/web, Dart theme for mobile | Same look and themes everywhere |
| Mobile app | Flutter (Dart language) | Looks exactly the same on iPhone and Android (D019) |
| Call server | LiveKit (open source) | Built for big meetings; we host it ourselves, so it's cheaper |
| Backend | Node.js + Fastify | Fast, same language as the apps |
| Database | PostgreSQL + pgvector | One database for normal data **and** AI search |
| Background jobs | Redis + BullMQ | Runs slow jobs (minutes, AI indexing) without blocking the app |
| Speech-to-text | Deepgram (cloud) / Whisper (local) | Top quality; local option for privacy |
| AI brain | Claude (cloud) / Ollama (local) | Best quality answers; local option |
| File storage | Cloudflare R2 | Cheap, no download fees |
| Email | **Mailpit** locally (a fake inbox to see test emails, free); a sending service (e.g. Resend/Amazon SES) when online | Invites, verification, minutes |
| Call relay (TURN) | LiveKit's built-in TURN server | Keeps calls working behind strict company firewalls (needs a domain + HTTPS when online) |
| Feature flags | Simple flags table in our database (or self-hosted Unleash later) | Turn features on gradually / for testers |
| Usage analytics | PostHog (free tier, privacy settings on, no transcript content ever) | Know which features are used. Comes with F10. |

## How the AI features work (simple)
1. **Transcript:** every person's microphone is a separate audio stream. We convert each stream to text, so we always know exactly who said what.
2. **Minutes:** when the meeting ends, the full transcript goes to the AI, which writes the summary, decisions and action items.
3. **Ask AI:** transcripts are cut into small pieces and stored with a "meaning fingerprint" (embedding) in the database (pgvector). When you ask a question, we find the pieces with similar meaning **and** matching keywords, then the AI answers using only those pieces and shows the sources.
4. **Persona:** your description is added to the AI's instructions, so it knows your context.
5. **Integrations:** the AI can use connected tools (via MCP) to create tickets, but only after you click "confirm".

## Code layout (when coding starts)
One repository with all apps (monorepo):
`apps/desktop`, `apps/web`, `apps/mobile`, `apps/api`, `apps/ai-worker`, `packages/ui`, `packages/core`, `packages/db`, `infra/`.
