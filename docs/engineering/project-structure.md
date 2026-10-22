---
status: accepted
updated: 2026-10-11
---

# Project Structure (Code Map)

The exact place for everything. When code is added, it goes where this map says. If something doesn't fit, update this map first (and log a decision).

## 1. Folder tree
```
meetapp/
├── CLAUDE.md                      Rules for Claude (whole project)
├── README.md                      Front page of the repo
├── mise.toml                      Locked tool versions (Node, pnpm, Python)
├── package.json                   Root scripts: dev, test, lint, check
├── pnpm-workspace.yaml            Lists the apps/packages
├── turbo.json                     Runs tasks across apps in the right order
├── .mcp.json                      Claude's shared tools (Context7, Playwright)
├── .claude/                       Claude setup: skills, agents, hooks, settings
├── .github/                       PR template, CI workflows, Dependabot
├── docs/                          ALL documentation (see docs/README.md); docs/getting-started.md = setup on a Mac; docs/runbooks/ = fixes for known problems (/diagnose)
├── infra/
│   ├── docker-compose.yml         Local services: LiveKit, Postgres, Redis, RustFS storage, Mailpit
│   ├── livekit.yaml               Local call-server settings
│   ├── load/                      `pnpm test:load` only: a second call server (127.0.0.1:7890, no webhooks) and the pinned `lk` load tool (F02)
│   └── monitoring/                Gatus, Prometheus, Alloy, Loki, Tempo, Grafana dashboards + alerts
│
├── apps/
│   ├── desktop/                   Electron shell (F04)
│   │   ├── CLAUDE.md              Rules for this app
│   │   └── src/
│   │       ├── main/              Window, security, app:// files, settings, Sentry, sign-in token and calls (F01: auth-token.ts keeps the token, auth-client.ts makes the sign-in calls and adds the bearer header, auth-actions.ts the list behind `window.meetapp.auth`, auth-bridge.ts the window bridge, provider-sign-in.ts the Google/Microsoft browser step); F02: media-permissions.ts (camera and mic for our own page, screen only through our picker), media-actions.ts and media-bridge.ts (`window.meetapp.media`), device-key.ts (`window.meetapp.deviceKey`); F03: chat-desktop.ts and chat-bridge.ts (spelling menu, `window.meetapp.files.save`) (later: deep links, updates, notifications)
│   │       └── preload/           The only bridge between app pages and the computer
│   │   (scripts/second-window.ts: `pnpm dev:window`, a second window with its own sign-in)
│   │
│   ├── web/                       React app: pages and app wiring (loaded inside desktop)
│   │   ├── CLAUDE.md
│   │   └── src/
│   │       ├── app/               Routing, providers (theme, query, i18n), error boundary
│   │       ├── pages/             One folder per screen: MeetingPage/, HomePage/ …
│   │       ├── features/          Page-level logic per feature: api/ (backend calls, 10 s limit), auth/, workspaces/, profile/, appearance/, flags/ (F01); meetings/ (F02), meetings/chat/ (F03: chat data and state; its screen parts are in pages/MeetingPage/Chat*.tsx and chat-*.ts); chats/ (F14: the live line, chat list, conversation, typing and the folding menu; its screen is pages/ChatsPage); later ask-ai/. Test helpers sit next to the feature (auth/fake-auth.tsx, workspaces/fake-api.ts)
│   │       │   └── meetings/      API hooks (useCreateMeeting, useJoinMeeting…), the visit store (visit.ts), devices, pre-join; call/ holds the call itself (useMeetingRoom with livekit-client, people, reactions, sharing, shortcuts)
│   │       └── locales/           Translation files: en.json …
│   │
│   ├── api/                       Backend (Fastify)
│   │   ├── CLAUDE.md
│   │   └── src/
│   │       ├── server.ts          Starts the server
│   │       ├── meetings.ts        Wires the meeting and call modules together (F02)
│   │       ├── config/            Settings from .env, validated at start
│   │       ├── plugins/           Error handler, logging, metrics, API docs; sign-in (auth.ts setup, auth-routes.ts allow-list, auth-providers.ts Google/Microsoft, auth-bridges.ts what services need, auth-adapter.ts stores session tokens as SHA-256 fingerprints (D048), session.ts), rate-limit.ts, workspace-access.ts, idempotency.ts, html-page.ts (the shared frame of the hand-off and invitation pages) (F01); meeting-ticket.ts (the X-Meeting-Ticket header, F02)
│   │       ├── modules/           One folder per business area:
│   │       │   ├── accounts/  workspaces/  invitations/  join-requests/   (F01; invitations/page/ is the invitation web page, accounts/page/ the Google/Microsoft hand-off page)
│   │       │   ├── meetings/  Making meetings, options, lookups by link or ID+passcode, expiry, the record (F02)
│   │       │   │   ├── meetings.routes.ts       HTTP endpoints only
│   │       │   │   ├── meetings.service.ts      Business rules
│   │       │   │   ├── meetings.repository.ts   Database access only
│   │       │   │   └── meetings.*.test.ts
│   │       │   ├── chat/      In-meeting chat: messages, reactions, pins, polls, files, GIFs (F03)
│   │       │   ├── chats/     Chats (F14): conversations, requests, groups, blocks, the live line (`/api/v1/realtime`), status and mentions
│   │       │   └── calls/     Joining, the lobby, in-call controls, ending (F02): calls.permissions.ts (the role table),
│   │       │                  livekit-webhook.routes.ts (joins and leaves from the call server), calls.jobs.ts (timeouts, the 30-hour limit)
│   │       ├── test-support/      Test-only helpers: the test backend (auth-app.ts), fake Google/Microsoft, Mailpit, photos, workspace/invitation/join/sweep set-ups. modules/test-support/ holds test-only routes, registered only when NODE_ENV is "test"
│   │       ├── emails/            Email templates (HTML + text, words in emails/locales/) and the email outbox queue (F01)
│   │       ├── jobs/              Background jobs (BullMQ)
│   │       ├── observability/     Tracing, Sentry, clean shutdown
│   │       └── providers/         Outside services behind interfaces, one file each: database, cache, livekit, storage, email
│   │
│   ├── ai-worker/                 Python: transcription, minutes, AI indexing (created in F05; the structure check refuses it earlier)
│   │   ├── CLAUDE.md
│   │   ├── pyproject.toml
│   │   ├── src/meetapp_ai/
│   │   │   ├── stt/               STTProvider: deepgram.py, whisper.py
│   │   │   ├── llm/               LLMProvider: claude.py, ollama.py
│   │   │   ├── pipelines/         transcription, minutes, indexing
│   │   │   └── prompts/           Versioned prompt files: minutes.v1.md …
│   │   ├── evals/                 AI quality test set (sample meetings + expected results)
│   │   └── tests/
│   │
│   └── mobile/                    Flutter app (F11), added later
│
├── packages/                      Shared code used by several apps
│   ├── ui/                        Design system: Atomic Design components (frontend.md)
│   │   ├── CLAUDE.md
│   │   └── src/ atoms/ molecules/ organisms/ templates/ hooks/
│   ├── design-tokens/             tokens.json → CSS variables (and Dart theme for mobile later)
│   ├── contracts/                 Zod schemas + types shared by frontend and backend; source of the OpenAPI file
│   ├── db/                        Database schema (Drizzle, src/schema/), migrations, seed data (seed.ts, seed-people.ts), test-database.ts (throwaway databases for tests)
│   ├── core/                      Shared non-UI logic: API client, utilities, constants (created when first needed)
│   └── config/                    Shared ESLint, TypeScript, Prettier, Vitest settings
│
├── tools/                       Dev scripts: preflight, dev runner and checks, test runner, load tests (load.ts, `pnpm test:load`), monitoring + alert notifier (notifier.ts) + its read-only database login (monitoring-db.ts), license check, structure check, flags, seed and its local-only guard (seed-guard.ts)
├── coverage/                    (generated by `pnpm test`, git-ignored) test coverage report: open coverage/index.html
└── tests/
    ├── e2e/                       Playwright end-to-end tests (real app flows)
    │   ├── desktop/               Real-window tests; shared steps in desktop.ts and workspace-steps.ts
    │   └── gallery/               Screenshot + accessibility check of every Storybook story and the invitation page (pnpm test:visual)
    ├── fixtures/                  Files that deliberately break rules, used to test the checks
    └── load/                      Load tests (100- and 25-person meetings, `pnpm test:load`; numbers in tests/load/test-results)
```

## 2. Naming rules
| Thing | Style | Example |
|---|---|---|
| React components and their folders | PascalCase | `MicToggleButton/MicToggleButton.tsx` |
| Hooks | camelCase, start with `use` | `useMeetingControls.ts` |
| Backend files | `<area>.<role>.ts` | `meetings.service.ts` |
| Other TS files | kebab-case | `meeting-id.ts` |
| Python files | snake_case | `deepgram_stt.py` |
| Database tables / columns | snake_case, plural tables | `meeting_participants.joined_at` |
| API URLs | `/api/v1/` + plural nouns, kebab-case | `/api/v1/meetings/:id/participants` |
| Constants | UPPER_SNAKE_CASE | `MAX_PARTICIPANTS` |
| Branches | one per feature: `feat/F02-short-name`; `fix/…`, `docs/…` (D026) | `feat/F02-meetings` |

## 3. Where things go
| Thing | Location |
|---|---|
| Unit tests | Next to the file: `x.ts` → `x.test.ts` |
| Component stories | Next to the component: `Button.stories.tsx` |
| End-to-end tests | `tests/e2e/<feature>/` |
| Shared types / validation | `packages/contracts` (never duplicated between frontend and backend) |
| Database changes | New migration in `packages/db/migrations` (never edit old ones) |
| AI prompts | `apps/ai-worker/src/meetapp_ai/prompts/` (versioned files, never inline) |
| Visible text | `apps/web/src/locales/*.json` |
| Secrets | `.env` only (never committed); every setting documented in `.env.example` |
| Imports between packages | Only through each package's public `index.ts`. Never reach into another package's internal files |

## 4. Folder-specific Claude rules
Each app and package has its own small `CLAUDE.md` (created in F00) with the rules for that area only, e.g. `apps/api/CLAUDE.md`: "routes → service → repository; every query filters by workspace_id". Claude reads it automatically when working in that folder, so the root CLAUDE.md stays short.
