---
feature: F15
title: Calls from chat (audio and video)
verdict: FAIL
date: 2026-10-28
---

# F15 Calls from chat (audio and video): Verification Report

First verification, run together with F14's second one (D069), 2026-10-27/28, on battery with `caffeinate` (Mac awake).

## Automated tests (whole project)
| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Unit + integration (all packages, coverage ≥ 80%) | 2213 | 0 | 10 todo |
| Desktop e2e | 38 | 73 | 0 |
| Screenshots (`pnpm test:visual`) | 525 | 120 | 0 |
| Load (`pnpm test:load`) | 3 | 2 | 0 |
| Backend container (`pnpm check:container`) | ✅ | | |
| Storybook build | ✅ | | |

`pnpm check`: ❌ dependency-cruiser, 7 errors (5 × `no-service-to-db` for type-only `@meetapp/db` imports in `apps/api/src/modules/calls/{transfer,call-removal,ring,chat-calls,call-end}.service.ts`; circular `add-people.service.ts` ↔ `ring.service.ts`; circular `packages/db/src/schema/conversations.ts` ↔ `meetings.ts`). The later check steps did not run.

**Desktop e2e:** 59 of the 73 failures are "no code email": the test backend allows about 50 sign-ups an hour and the run used them up (environment, as in F14's first verification). 14 are real: 12 in the new F15 specs (first run: `chat-call`, `being-called`, `calls-keyboard`; e.g. the header call buttons re-render while clicked, the call route not reached), `security.spec` TC-F00-61 (expects the old CSP without `'wasm-unsafe-eval'`), and `chat.spec` TC-F03-69, `chats-keyboard` TC-F14-60, `sign-in` TC-F01-01 (to check after a rerun with sign-ups available).

**Screenshots:** 120 differences, all in F14 and F15 components that have no approved pictures yet (ChatListItem, NavRail, ConversationHeader, ChatList, PeoplePicker, HistoryChoice, StatusDot, CallingScreen, IncomingCall, TypingIndicator, CallNote, GroupDetails, SeenMark, RingtonePicker, ChatRequestCard, BackgroundPicker; plus AppLayout and Icon). The owner looks at them, then `pnpm test:visual:update`.

## Acceptance criteria
ac-verifier, from code and tests: 33 of 34 PASS in code; AC-F15-17 (screens match the approved designs) waits for the screenshots above. Timing ACs measured by the load test: AC-05/06 met (below).
| AC | Result | Evidence |
|---|---|---|
| AC-F15-01–16, 18–34 | PASS (code + unit/integration tests) | see tests.md tags; e2e reruns pending |
| AC-F15-17 | WEAK | screenshots not approved yet (TC-F15-55) |

## Security
Dependency audit: 17 known findings (2 high: `undici`, `zod`; 10 moderate; 5 low), unchanged since T1, for `/deps-update`. Secrets scan: `gitleaks` is not installed (not run).
| Severity | Where | Problem | Fix |
|---|---|---|---|
| Medium | `chat-calls.service.ts` takeSeat/join, `transfer.service.ts` | Join and transfer add seats for a person already in the call without a rate limit; one member can fill the call server's 25 places | Cap seats per person per call (2) and rate-limit join and transfer |
| Low | `ring.service.ts` ringingFor | rings re-sent on connect check only the caller's place | also check the person being rung |
| Low | `ring.service.ts` cancel | starter check before membership | check membership first |
No Critical or High.

## Quality targets (docs/product/quality-targets.md)
| Target | Measured | Result |
|---|---|---|
| Ring delivered (95%, 20 groups of 20 at once, 250 connected) | 574 ms | ✅ (< 2 s) |
| Accept answer (95%) | 101 ms | ✅ (< 3 s) |
| 20-person chat call join answer (95%) | 25 ms; 21st refused (409) | ✅ (test reads the error code wrongly: fix the test) |
| Group of 250: message shown (95%, F14) | 326 ms | ✅ (< 1 s) |
| 100-person meeting: tiles show ≥ 90% of frames | 24% | ❌ on battery and a busy Mac (D056: re-check on power) |
| Background speed (TC-F15-78) | not run (reference Mac only) | — |

## UI review (Atomic Design, accessibility)
Must fix: disabled call buttons hide their reason from keyboard and screen readers (`ConversationHeader.tsx` CallButton: use `aria-disabled` + described reason); two rings at once fight for focus, a ring takes focus from a text field, duplicate `incoming-call-who` id, double announcement (`IncomingCall.tsx`, `IncomingCalls.tsx`). Should fix: OtherDevice pending/Retry; BackgroundPicker hint not linked; RingtonePicker focus/value; Call again icon for audio; preview placeholder; missed CallNote not announced; check contrast of accept buttons.

## Code quality (complexity, duplication, patterns)
Must fix: the 7 dependency-cruiser errors above. Should fix: "enter a call" logic in three places (`use-start-call.ts`, `IncomingCalls.tsx`, `OtherDevice.tsx`, the last also sets `oneToOne: false` always); query keys duplicated (`ring-settings`, `active-calls`); split `IncomingCalls.tsx` hooks; explicit translation keys. Score 6.5/10.

## Documentation check
Must fix: progress.md "Now"/"After"/"Next step" lines and "32 ACs"; design.md section 1 (Settings pages are `DevicesSettingsPage`/`CallsSettingsPage`), section 5 add `CALL_ENDED`; project-structure.md (devices moved, `chat-calls.ts`, calls module files); READMEs of apps/api, apps/web, packages/ui, packages/contracts, packages/db. Should fix: privacy-legal.md (backgrounds stay on the computer; ring data), D073 and design.md wording about the pictures (drawn for MeetApp), apps/desktop/CLAUDE.md (the approved WebAssembly exception), OtherDevice bar in packages/ui with a story, header dates, small design.md wording.

## Bugs found
1. High: pressing Video/Audio call while a call already runs leaves the person stuck on "Calling…" (`use-start-call.ts` always enters as ringing; the start answer must say whether the call is new).
2. Medium: a failed Accept uses up the ring (`ring.service.ts` stops the ring before joining) and the app has already left the current meeting (`IncomingCalls.tsx` leaves before accepting).
3. Medium: the background turns itself off on cameras slower than 15 fps or while the window is hidden (`backgrounds.ts` frame monitor).
Low: OtherDevice transfers only the first seat and sets `oneToOne: false`; the preview may flash a stopped stream; the meeting chat handler may be stale if `announce` isn't stable.

## Verdict
**FAIL.** Every unit and integration test passes and the call speed targets are met, but the code-structure check is red, three bugs need fixing (one makes a person stuck on the Calling screen), the incoming call has accessibility problems, the new desktop tests need their first fixes, the new screens need the owner's look, and several documents are behind. Fix tasks T-fix-1 to T-fix-9 are in tasks.md.
