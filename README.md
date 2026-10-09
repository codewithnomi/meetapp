# MeetApp

A meeting app like Microsoft Teams or Zoom (audio, video and screen sharing for up to 100 people) with AI built in:
- live transcripts with speaker names
- automatic minutes of meeting
- **Ask AI** about past meetings
- personal context (persona)
- one-click integrations (Jira, Linear, GitHub…)

**Platforms:** desktop (Mac, Windows) first, then web, then mobile (Flutter).

## Status
📝 **Planning / specification stage.** No application code yet; every feature is specified and approved before it's built.
See [docs/progress.md](docs/progress.md) for the current state.

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
