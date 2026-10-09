---
status: accepted
updated: 2026-10-09
---

# Code Quality & Design Patterns

Goal: code that is easy to read, change and test, even years later and by someone new.
Checked three ways: **automatically after every edit** (Claude hook), **on every Pull Request** (CI), and by the **`code-quality-reviewer`** helper when a feature is verified.

## 1. Principles
- **Single responsibility:** each file, class and function does one thing. If you need "and" to describe it, split it.
- **SOLID**, especially:
  - **dependency inversion:** business logic depends on interfaces, not on specific tools like "Deepgram" or "Postgres".
  - **open/closed:** add a new provider without changing old code.
- **DRY, but not too early:** remove real duplication; don't build abstractions "for later".
- **KISS / YAGNI:** the simplest thing that meets the spec. No features the spec didn't ask for.
- **Names explain intent:** `canUserJoinMeeting()` not `check()`. No abbreviations except well-known ones (id, url, api).
- **Fail loudly and early:** validate inputs at the edges; never swallow errors silently.
- **Pure where possible:** business rules as plain functions without side effects are easy to test.

## 2. Design patterns we use (and where)
| Pattern | What it means simply | Where in MeetApp |
|---|---|---|
| **Layered architecture** | Each layer has one job | routes → services → repositories (backend.md) |
| **Repository** | One place that talks to the database per data type | `MeetingRepository`, `TranscriptRepository` |
| **Service layer** | Business rules live in one place, independent of HTTP or UI | `MeetingService.join()` checks permissions |
| **Dependency injection** | Parts receive what they need instead of creating it, so tests can pass in fakes | services get repositories and providers via constructor |
| **Strategy / Adapter** | Swap one implementation for another behind the same interface | `STTProvider` (Deepgram ↔ Whisper), `LLMProvider` (Claude ↔ Ollama), `AuthProvider` (Google ↔ Microsoft), MCP tools |
| **Factory** | One place decides which implementation to create | picks cloud vs local AI from config (D008) |
| **Observer / events** | "Something happened" messages others can react to | `meeting.ended` → minutes job → indexing job |
| **Queue / background job** | Slow work runs separately | BullMQ jobs (minutes, embeddings) |
| **Atomic Design** | UI in levels | frontend.md |
| **Container / presentational** | Pages fetch data; components only display | pages vs atoms/molecules/organisms |
| **Custom hooks** | Reusable UI logic outside components | `useMeetingControls()`, `useTheme()` |

Avoid: god-classes/files, global mutable state, deep inheritance (prefer composition), "utils" dumping grounds, magic numbers or strings (use named constants).

## 3. Hard limits (checked automatically)
| Rule | Limit |
|---|---|
| Function length | ≤ 50 lines |
| File length | ≤ 300 lines (excluding tests) |
| Cognitive complexity per function | ≤ 15 |
| Function parameters | ≤ 4 (otherwise pass an object) |
| Nesting depth | ≤ 3 |
| Code duplication | ≤ 3% |
| `any` type in TypeScript | not allowed (use `unknown` + validation) |
| Unused code, exports, dependencies | not allowed |
| Layer violations (e.g. route → database directly, atom → organism) | not allowed |
| `console.log` in committed code | not allowed (use the logger) |
| TODO without a linked task | not allowed |

A limit may be broken only with a comment explaining why, and the reviewer must agree.

## 4. Tools (all free)
| Language | Tools |
|---|---|
| TypeScript / React | **ESLint** (+ `typescript-eslint` strict, `eslint-plugin-sonarjs` for complexity/code smells, `eslint-plugin-boundaries` for Atomic + layer rules, `jsx-a11y`), **Prettier** (formatting), **dependency-cruiser** (architecture rules), **knip** (unused code), **jscpd** (duplication) |
| Python (AI worker) | **ruff** (lint + format), **mypy** (types, strict) |
| Dart (Flutter, later) | **dart analyze** with `very_good_analysis` rules, **dart format** |

## 5. Code review checklist (used by `code-quality-reviewer`)
Readable names · one responsibility · correct layer · right pattern (and not over-engineered) · no duplication · errors handled · tests are meaningful (not just coverage) · no dead code · matches design.md · comments explain *why*, not *what*.
