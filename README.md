# MeetApp

A meeting app like Microsoft Teams or Zoom (audio, video and screen sharing for up to 100 people) with AI built in:
- live transcripts with speaker names
- automatic minutes of meeting
- **Ask AI** about past meetings
- personal context (persona)
- one-click integrations (Jira, Linear, GitHub…)

**Platforms:** desktop (Mac, Windows) first, then web, then mobile (Flutter).

## Status
🏗️ **Built:** Foundation (F00), Accounts & workspaces (F01), Meetings & calling (F02), In-meeting chat (F03), Chats (F14), Calls from chat (F15), Calls while MeetApp isn't in front (F16). **Being built:** the Desktop app (F04: installers, menu-bar icon, meeting links, status by hand, MeetApp's own notification cards). Then browsing during a call (F17), scheduling, and the AI features, each specified and approved before it's built.
See [docs/progress.md](docs/progress.md) for the current state.

## Run it
See **[docs/getting-started.md](docs/getting-started.md)**. In short, with Docker Desktop running: `mise install`, `pnpm install`, `pnpm dev`.

## Documentation
Start at **[docs/README.md](docs/README.md)**.

| What | Where |
|---|---|
| Vision | [docs/product/vision.md](docs/product/vision.md) |
| Complete feature plan & build order | [docs/product/features.md](docs/product/features.md) |
| Architecture & decisions | [docs/architecture/](docs/architecture/) |
| Engineering rules (code quality, Atomic Design, Git/CI) | [docs/engineering/](docs/engineering/) |
| Feature specs | [docs/specs/INDEX.md](docs/specs/INDEX.md) |

## How we work: spec-driven development with Claude Code
Each feature moves through: **requirements → design → tests + tasks → code → verification** (all tests, acceptance criteria, security, code quality, docs).
The workflow, helpers and automation live in [`.claude/`](.claude/) and are explained in [docs/claude-guide.md](docs/claude-guide.md).

## License
Proprietary. All rights reserved.
