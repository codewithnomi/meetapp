# MeetApp Documentation

Start here. Read in this order:

1. **[progress.md](progress.md)**: where we are right now and what's next
2. **[product/vision.md](product/vision.md)**: what we're building and why
3. **[product/features.md](product/features.md)**: every feature, by phase
4. **[architecture/overview.md](architecture/overview.md)**: how it's built
5. **[architecture/infrastructure.md](architecture/infrastructure.md)**: where it runs, now and later
6. **[architecture/decisions.md](architecture/decisions.md)**: the decisions and their reasons
7. **[specs/INDEX.md](specs/INDEX.md)**: detailed spec status per feature
8. **[claude-guide.md](claude-guide.md)**: how we use Claude (commands, helpers, automation)

More reference documents:
- Product: [glossary.md](product/glossary.md) · [quality-targets.md](product/quality-targets.md) · [privacy-legal.md](product/privacy-legal.md)
- Engineering: [project-structure.md](engineering/project-structure.md) (code map) · [code-quality.md](engineering/code-quality.md) · [frontend.md](engineering/frontend.md) (Atomic Design) · [backend.md](engineering/backend.md) · [git-ci-release.md](engineering/git-ci-release.md) · [operations.md](engineering/operations.md)
- Security: [architecture/security.md](architecture/security.md)

## How a feature goes from idea to code
```
 requirements.md → design.md → tests.md + tasks.md → code + tests → verification.md
   (WHAT)           (HOW)       (TEST CASES, STEPS)   (each step)     (all tests + security)
   owner approves   owner approves  owner approves     all tests pass   PASS = feature done
```
Security rules every feature follows: [architecture/security.md](architecture/security.md)
