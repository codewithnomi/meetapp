# @meetapp/contracts

## What it is
Zod schemas shared by the backend and the apps: what each endpoint receives and returns. The backend's API documentation (`/docs`, OpenAPI) is generated from them, and the mobile app's client will be generated from that file (D019).

- `src/errors.ts`: the standard error body `{ error: { code, message, requestId, details? } }`.
- `src/health.ts`: the health check response.
- `src/flags.ts`: the feature flags list.
- `src/workspaces.ts`, `src/accounts.ts`… (F01): accounts, workspaces, members, invitations, join requests.
- `src/meetings.ts`, `src/calls.ts` (F02): every meeting and call endpoint, and the call server's data messages.
- `src/chat.ts`, `src/chat-extras.ts` (F03): meeting chat: the message document, messages, news, reactions, pins, polls, files, GIFs, the sticker names (`STICKERS`), and past meetings' chats.
- `src/chat-calls.ts` (F15): calls from chats: start, the running call with its members, Add people, accept and decline, the `ring` and `ring_stop` messages, active calls on other devices, transfer, ringtone settings (the start answer `startedCallSchema` sits in `src/calls.ts`).
- `src/chat-notes.ts` (F14/F15): chat notes, including the call notes (started, ended, missed).
- `src/chats.ts` (F14): chats: conversations and the chat list, New chat's people, requests, blocks, groups, read marks, status, and the live line's messages both ways.

## Run it
Nothing to start: the backend and the apps import it.

## Test it
Covered by the backend tests in `apps/api` (part of `pnpm test`); types are checked by `pnpm typecheck`.
