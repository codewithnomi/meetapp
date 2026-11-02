---
status: draft
updated: 2026-10-28
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
| Calling in the app | livekit-client (D055) | LiveKit's own library for joining calls from the desktop and web app |
| Meeting chat | our backend + the call server's data channel (D060) | The backend checks and saves every message, then the call server delivers it to everyone in the meeting |
| Chats (one-to-one and groups, F14) | our backend + a live line (WebSocket, `@fastify/websocket`, D064) | One conversation model for every chat (D065); the backend checks and saves every message; the live line brings new messages, typing, "Seen", status and list changes instantly. Several API servers share news through Redis publish/subscribe; if Redis is down the apps check every 10–30 seconds instead |
| Calls from chats (F15) | the same call server and livekit-client as meetings (D072) + the live line for ringing | A call belongs to a meeting or a chat; one running call per chat, 20 people, everyone equal. Rings go to every open window through "ring targets" (phones later, D075); a 30-second job ends unanswered rings. Ringtones are made by the app (D074) |
| Camera backgrounds (F15) | `@livekit/track-processors` with MediaPipe (D073) | Blur and 8 pictures, made on the computer; the engine, model and pictures ship with the app |
| Chat message box | TipTap (rich text, with @mentions: `@tiptap/extension-mention`, `@floating-ui/dom`, D067), Frimousse (emoji) | Formatting, code and emoji, saved as a strict document, never as HTML |
| GIFs in chat | KLIPY, free (D059) | Searched by each person's app; nothing about GIFs is stored on our server |
| Backend | Node.js + Fastify | Fast, same language as the apps |
| Database | PostgreSQL + pgvector | One database for normal data **and** AI search |
| Background jobs | Redis + BullMQ | Runs slow jobs (minutes, AI indexing) without blocking the app. Redis also passes chat news between API servers and keeps who is online (F14) |
| Speech-to-text | Deepgram (cloud) / Whisper (local) | Top quality; local option for privacy |
| AI brain | Claude (cloud) / Ollama (local) | Best quality answers; local option |
| File storage | Cloudflare R2 online; **RustFS** on the Mac (same S3 API, D035) | Cheap, no download fees |
| Email | **Mailpit** locally (a fake inbox to see test emails, free); a sending service (e.g. Resend/Amazon SES) when online | Invites, verification, minutes |
| Call relay (TURN) | LiveKit's built-in TURN server | Keeps calls working behind strict company firewalls (needs a domain + HTTPS when online) |
| Feature flags | Simple flags table in our database (or self-hosted Unleash later) | Turn features on gradually / for testers |
| Usage analytics | PostHog (free tier, privacy settings on, no transcript content ever) | Know which features are used. Comes with F10. |
| Monitoring | Gatus (status page), Grafana Alloy (collector), Prometheus, Loki, Tempo, Grafana (D027, D030, D041) | Know what is down and why; alerts by email and Mac notification |
| Building and checking the code | pnpm workspaces + Turborepo; Vitest, Playwright, Storybook; ESLint, Prettier, dependency-cruiser, knip, jscpd | One repository, every check automatic (code-quality.md) |
| Backend libraries | Drizzle (database), ioredis (cache), Pino (logs), Zod (input checks), nodemailer (email), AWS S3 client (files), file-type and sharp (checking and cleaning chat files, F03), LiveKit server SDK, OpenTelemetry (traces) | Small, well-known, free (D043) |

## How the AI features work (simple)
1. **Transcript:** every person's microphone is a separate audio stream. We convert each stream to text, so we always know exactly who said what.
2. **Minutes:** when the meeting ends, the full transcript goes to the AI, which writes the summary, decisions and action items.
3. **Ask AI:** transcripts are cut into small pieces and stored with a "meaning fingerprint" (embedding) in the database (pgvector). When you ask a question, we find the pieces with similar meaning **and** matching keywords, then the AI answers using only those pieces and shows the sources.
4. **Persona:** your description is added to the AI's instructions, so it knows your context.
5. **Integrations:** the AI can use connected tools (via MCP) to create tickets, but only after you click "confirm".

## Code layout
One repository with all apps (monorepo), exact map in `docs/engineering/project-structure.md`:
`apps/desktop`, `apps/web`, `apps/api`, `packages/ui`, `packages/design-tokens`, `packages/contracts`, `packages/db`, `packages/config`, `infra/`, `tools/`. Later: `apps/ai-worker` (F05), `apps/mobile` (F11), `packages/core` (when first needed).
