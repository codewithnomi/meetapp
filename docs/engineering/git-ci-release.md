---
status: draft
updated: 2026-10-09
---

# Git, Automatic Checks (CI) and Releases

## 1. Git & GitHub
- Code lives in a **private GitHub repository**.
- `main` is always working and releasable. Nobody pushes directly to `main`.
- Each task is built on a short-lived branch: `feat/F02-T3-screen-share`, `fix/F02-mute-bug`, `docs/…`.
- Commit messages follow **Conventional Commits**: `feat(F02): add screen share`, `fix(F05): …`, `docs: …`. These generate the changelog automatically.
- Each branch becomes a **Pull Request (PR)** using a template with: which feature/task, which ACs are covered, test results, screenshots, and a docs-updated checkbox.
- **Before every commit** (automatic, via husky + lint-staged): format, lint, and a secrets check on changed files.

## 2. CI: automatic checks on every Pull Request (GitHub Actions)
A PR can only be merged when all of these pass:
1. Install + build every app
2. Lint + typecheck + Atomic Design and layer rules + code-quality limits (complexity, duplication, unused code; see code-quality.md)
3. Unit tests and integration tests (with a real Postgres/Redis in Docker), with minimum test coverage of 80% on business logic
4. End-to-end tests (Playwright) on the web build
5. Dependency vulnerability scan + secrets scan (gitleaks) + code security scan (Semgrep; free for private repos)
6. Storybook builds (UI docs never break)
7. **Visual screenshot tests** of every component story: an unexpected visual change fails until approved
8. **License check:** fails if a library's license would force us to publish our code (e.g. GPL/AGPL)

## 2b. Keeping libraries up to date & safe
- **Dependabot** (free on GitHub) opens Pull Requests automatically when a library has an update or a security fix. They go through the same checks.
- Exact library versions are locked (`pnpm-lock.yaml`), so every computer and CI builds the same thing.

> **Note (D017):** for now only **local** exists and nothing is signed or deployed. Staging, production, code signing and the paid accounts below come later, when the owner decides.

## 3. Environments
| Name | Purpose | Data |
|---|---|---|
| **local** | Your computer; everything runs in Docker | Fake/sample data |
| **staging** | Online copy of production for final testing; updated automatically when `main` changes | Fake data |
| **production** | Real users | Real data, backed up |

Each environment has its own secrets, databases and API keys. Secrets are stored in a secrets manager / GitHub encrypted secrets, never in the code.

## 4. Releases
- **Version numbers:** Semantic Versioning `MAJOR.MINOR.PATCH` (e.g. 1.4.2). Changelog generated from commits.
- **Backend:** deployed automatically to staging; deployed to production with one click after checks.
- **Desktop app:** built by CI for Mac and Windows.
  - **Code signing is required**, otherwise Mac/Windows show "unknown developer" warnings and block the app. Needs an **Apple Developer account (~$99/year)** and a **Windows code-signing certificate** (e.g. Azure Trusted Signing, low monthly cost).
  - Auto-update with two channels: **beta** (testers) and **stable** (everyone).
- **Mobile (later):** Apple App Store and Google Play developer accounts.
- **Database changes** are applied automatically during deployment and must be backwards compatible for one version (older desktop apps keep working).
