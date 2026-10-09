---
status: accepted
updated: 2026-10-09
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
├── docs/                          ALL documentation (see docs/README.md)
├── infra/
│   ├── docker-compose.yml         Local services: LiveKit, Postgres, Redis, MinIO, Mailpit
│   ├── livekit.yaml               Local call-server settings
│   └── monitoring/                Prometheus, Grafana dashboards + alerts, Loki, Tempo, Uptime Kuma config
│
├── apps/
│   ├── desktop/                   Electron shell (F04)
│   │   ├── CLAUDE.md              Rules for this app
│   │   └── src/
│   │       ├── main/              Window, permissions, deep links, updates, notifications
│   │       └── preload/           The only bridge between app pages and the computer
│   │
│   ├── web/                       React app: pages and app wiring (loaded inside desktop)
│   │   ├── CLAUDE.md
│   │   └── src/
│   │       ├── app/               Routing, providers (theme, query, i18n), error boundary
│   │       ├── pages/             One folder per screen: MeetingPage/, HomePage/ …
│   │       ├── features/          Page-level logic per feature: auth/, meetings/, chat/, ask-ai/
│   │       │   └── meetings/      hooks (useJoinMeeting), api calls, state stores
│   │       └── locales/           Translation files: en.json …
│   │
│   ├── api/                       Backend (Fastify)
│   │   ├── CLAUDE.md
│   │   └── src/
│   │       ├── server.ts          Starts the server
│   │       ├── config/            Settings from .env, validated at start
│   │       ├── plugins/           Auth, rate limiting, error handler, logging
│   │       ├── modules/           One folder per business area:
│   │       │   └── meetings/
│   │       │       ├── meetings.routes.ts       HTTP endpoints only
│   │       │       ├── meetings.service.ts      Business rules
│   │       │       ├── meetings.repository.ts   Database access only
│   │       │       ├── meetings.schemas.ts      Zod input/output (or from packages/contracts)
│   │       │       └── meetings.test.ts
│   │       ├── jobs/              Background jobs (BullMQ)
│   │       └── providers/         Outside services behind interfaces: livekit/, email/, storage/
│   │
│   ├── ai-worker/                 Python: transcription, minutes, AI indexing (F05+)
│   │   ├── CLAUDE.md
│   │   ├── pyproject.toml
│   │   ├── src/meetapp_ai/
│   │   │   ├── stt/               STTProvider: deepgram.py, whisper.py
│   │   │   ├── llm/               LLMProvider: claude.py, ollama.py
│   │   │   ├── pipelines/         transcription, minutes, indexing
│   │   │   └── prompts/           Versioned prompt files: minutes.v1.md …
│   │   ├── evals/                 AI quality test set (sample meetings + expected results)
│   │   ├── docs/runbooks/                 Step-by-step fixes for known problems (written by /diagnose)
└── tests/
│   │
│   └── mobile/                    Flutter app (F11), added later
│
├── packages/                      Shared code used by several apps
│   ├── ui/                        Design system: Atomic Design components (frontend.md)
│   │   ├── CLAUDE.md
│   │   └── src/ atoms/ molecules/ organisms/ templates/ hooks/
│   ├── design-tokens/             tokens.json → CSS variables (and Dart theme for mobile later)
│   ├── contracts/                 Zod schemas + types shared by frontend and backend; source of the OpenAPI file
│   ├── db/                        Database schema (Drizzle), migrations, seed data
│   ├── core/                      Shared non-UI logic: API client, utilities, constants
│   └── config/                    Shared ESLint, TypeScript, Prettier, Vitest settings
│
└── tests/
    ├── e2e/                       Playwright end-to-end tests (real app flows)
    └── load/                      Load tests (100-person meetings)
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
| Branches | `feat/F02-T3-short-name`, `fix/…`, `docs/…` | `feat/F02-T3-screen-share` |

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
