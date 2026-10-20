# Runbook: calls (the call server and the load test)

How meetings run on this Mac (F02 design.md sections 3 and 7) and how to check them.

## The call server (LiveKit)
- Starts with `pnpm dev` (`infra/docker-compose.yml`, settings in `infra/livekit.yaml`). The app connects to `ws://127.0.0.1:<LIVEKIT_PORT>` (7880 by default); media uses 7881 (tcp) and 7882 (udp).
- Only the backend makes rooms (`auto_create: false`): a call pass for a room that doesn't exist can't open one. Each room is named after the call's id, each person after their attendance id.
- The call server reports joins, leaves and the end of a call to the backend (`/api/v1/livekit/webhook`, signed with the API key). The backend removes anyone in a room it didn't let in.
- At most 100 people per room (the backend checks first).
- Its key and secret come from `.env` (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`), never from the yaml file.

### Two people in a meeting on one Mac
While `pnpm dev` runs, `pnpm dev:window` opens a second app window with its own sign-in. Meet now in one window, copy the link from Meeting info, and join with it in the other.

### When a call doesn't connect
| What you see | Check |
|---|---|
| "Can't reach MeetApp" before joining | the backend: `curl http://127.0.0.1:<API_PORT>/api/v1/health` |
| Join now works, but the call stays on "Connecting" | `docker compose -f infra/docker-compose.yml --env-file .env ps livekit` is healthy; nothing else uses 7880–7882 |
| Someone is removed right after joining | the backend log: the webhook refused them (old pass, removed, call ended) |
| No camera or microphone (macOS) | System Settings → Privacy & Security → Camera / Microphone → MeetApp (or Electron, in development) |
| Screen sharing does nothing (macOS) | System Settings → Privacy & Security → Screen Recording → MeetApp; then restart the app |

Logs: `docker compose -f infra/docker-compose.yml --env-file .env logs livekit`.

## The load test (`pnpm test:load`)
Fills a meeting with simulated people and measures the app (TC-F02-25, 41, 92; targets in quality-targets.md and D056).

1. Close `pnpm dev` (the test starts its own backend) and leave the Mac idle for about 15 minutes: the simulated people run on this Mac, and other work lowers every number.
2. Run `pnpm test:load`. It:
   - starts the normal services, plus a second call server on port 7890 that sends no reports to the backend (`infra/load/`), so the simulated people aren't removed;
   - starts the backend pointed at that call server, with `CALLS_KEEP_SIMULATED_PEOPLE=true` so the once-a-minute clean-up leaves the simulated people (`sim_…`) in the call (the backend refuses this setting in production), and builds the app;
   - runs `tests/load`: 99 simulated people with video (LiveKit's `lk perf load-test`, Docker image pinned in `infra/load/docker-compose.load.yml`) plus the app as the 100th; then 24 plus the app for 5 minutes;
   - stops the backend and the second call server.
3. Read the numbers in `tests/load/test-results/load-results.json` (and a picture, `hundred-people.png`). The simulated people's own log is next to it (`lk-100.log`, `lk-25.log`).

| Number | Target |
|---|---|
| Sound delay (100 people) | under 250 ms |
| Join time, Join now to the first sound (20 joins, 95th percentile) | under 3 s |
| Each tile's shown frames against the frames it receives | at least 90% |
| Memory of the app in a 25-person meeting, 5 minutes | under 700 MB |

The 20 joins are spaced 7 seconds apart: the backend allows 10 joins a minute from one address (S5).

If it stops early: `docker compose -f infra/load/docker-compose.load.yml --env-file .env --profile tool down --remove-orphans` removes what's left.
