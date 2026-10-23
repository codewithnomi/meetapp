---
feature: F14
title: Chats (one to one and groups)
verdict: FAIL
date: 2026-10-23
---

# F14 Chats (one to one and groups): Verification Report (first run)

## Automated tests (whole project)
| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Unit + integration | 2043 | 0 | 10 todo |
| Desktop (E2E) | 58 | 35 | 0 |
| Gallery screenshots + axe | 525 | 86 (no baseline yet for the new F14 parts) | 0 |

Typecheck, lint, architecture, duplication, unused code, structure, licences (`pnpm check`): ✅ · Backend container (`pnpm check:container`): ✅ · Storybook build: ✅

- **Coverage:** branches in `apps/web/src/features/**` 77.92%, under the 80% rule ❌ (the new `features/chats` code).
- **Desktop:** most of the 35 failures are "no code email": the test backend allows 50 sign-ups an hour, used up by the day's earlier runs (load test and keyboard reruns), so new test accounts couldn't be made. Not an app fault; to be rerun after an hour. TC-F14-60 and 61 passed in the same session.
- **Screenshots:** the 86 failures are the new F14 parts (StatusDot, ChatListItem, ChatList, NavRail, AppLayout…) with no approved picture yet (D052: made at verification); to be created with `pnpm test:visual:update` after the owner looks at them.

## Acceptance criteria
34 of 36 PASS (ac-verifier). Gaps:
| AC | Result | Evidence |
|---|---|---|
| AC-F14-29 | WEAK | paging code exists (`limit`/`before`), but no test opens a long chat or loads older pages (TC-F14-59 not written as specified) |
| AC-F14-35 | WEAK | workspace deletion removes chats by database cascade only; no test of files removed within 30 days or the 400-day keep (TC-F14-72 covers only mute/hide) |

## Security
Dependency audit (`pnpm audit --prod`): 1 moderate (esbuild, through drizzle-kit, development tool path), 1 low (fastify header validation). Secrets scan: gitleaks not installed (the commit hook's secret scan ran on every commit).
| Severity | Where | Problem | Fix |
|---|---|---|---|
| Medium | `chats-line.routes.ts:40-55` | The live line's upgrade doesn't check the page's Origin; matters once the web app signs in with cookies (F10) | refuse the upgrade unless Origin is allowed; test it |
| Low | `chats-line.ts:110` | a malformed Redis message would throw in the subscriber | parse safely and drop bad messages |
| Low | `chats-people.service.ts:31-43` | exact-email lookup confirms an account exists (as in Teams, rate-limited) | record as an accepted product choice |
| Low | `chats-line.ts:208-213` | each line re-reads its session every second | cache briefly or close on sign-out news; limit line opening |

No Critical or High.

## Quality targets (docs/product/quality-targets.md)
| Target | Measured | Result |
|---|---|---|
| Chat message shown within 1 s (95%), 250-person group | 337 ms (slowest 510 ms), every line got all 300 messages, none dropped (T18) | ✅ |
| Message between two windows within 1 s | TC-F14-40, T17 | ✅ |

## UI review (Atomic Design, accessibility)
Structure, tokens, translations and stories pass. **Must fix:** no loading or error state on the chat list (it says "No chats yet" while loading or after a failure), Chat requests, a conversation and Group details; read-mark failures ignored silently; no page-level tests for `pages/ChatsPage` (or a recorded decision that the desktop tests cover them). Should fix: two h1 headings per screen (panes should be h2); unread names built in code instead of translated ("Chat 3"); the fold button's title duplicates its name; long chat lists not virtualised or limited.

## Code quality (complexity, duplication, patterns)
No Must fix; 0 duplicates; layering respected (score 8/10). Should fix: errors swallowed without a reason in `chats-line.ts`; `chats-line.ts` (277 lines) and `ChatComposer.tsx` (276) near the 300-line limit.

## Documentation check
Must fix: design.md names `modules/realtime` / `features/realtime` folders that don't exist; no decision record for `@tiptap/extension-mention`, `@tiptap/suggestion`, `@floating-ui/dom` (added in T16); overview.md doesn't mention chats or the live line (and Redis's new use, `@fastify/websocket`); operations.md has no F14 background-work section; privacy-legal.md misses per-person chat settings (read receipts, pin/mute/hide); desktop README misses `power.onLockChange`; progress.md "Current state" is stale and too long. Should fix: design.md status rule (code shows "Away" for 30 s after the app closes, then Offline: owner to decide), endpoint table, D064/D065 still "proposed", security.md S5 rate limits, project-structure load tests, tasks.md T2 column name.

## Bugs found (bug-finder)
1. **High (privacy):** the chat list's last message and unread count ignore the person's read window: someone added with "no history" sees older text, someone removed keeps seeing new messages' first lines and a growing unread count (`chats.repository.ts` `lastMessages`, `unreadCounts`).
2. **Medium:** a line closed while it is still starting keeps its Redis subscriptions, and its id counts toward the 5-line limit (`chats-line.ts` `refresh`/`open`).
3. **Medium:** with a filter or search on, the open chat disappears when it stops matching (e.g. read under "Unread"); the draft is lost (`ChatsPage.tsx`).
4. **Medium:** the app reconnects after the server replaced its line (4001), so 6+ windows push each other out forever; an old socket's close can clear the new one's ping (`live-line.ts`).
5. Low/Medium: New chat's Start can make two groups on a double click; Invite has no error handling.
6. Low: read marks use time, not news numbers; a pending invitee's read sends "Seen".
7. Low: editing a message skips mention cleaning.

## Verdict
**FAIL.** The chats work and are fast (the 250-person test passed easily), but the reviews found one privacy bug, three medium bugs, missing loading/error states, two weakly tested criteria, a coverage shortfall and documentation gaps. Each is a fix task (T-fix-1 to T-fix-9) in tasks.md. The desktop tests that failed for lack of sign-ups and the new screenshots are rerun in the second verification.
