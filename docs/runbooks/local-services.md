# Runbook: local services

The services `pnpm dev` starts in Docker (`infra/docker-compose.yml`, design.md section 3). Every port listens on 127.0.0.1 only, so other devices on the Wi-Fi can't connect. Data lives in Docker volumes and survives restarts of the services and of the Mac.

| Service | Address (default port, moved with the `.env` setting) | Used for |
|---|---|---|
| Database (PostgreSQL + pgvector) | 127.0.0.1:5432 (`POSTGRES_PORT`) | All app data |
| Cache and job queue (Redis) | 127.0.0.1:6379 (`REDIS_PORT`) | Fast lookups, background jobs |
| Call server (LiveKit) | ws://127.0.0.1:7880 (`LIVEKIT_PORT`); media on 7881 and 7882/udp | Audio and video |
| File storage (RustFS, S3) | http://127.0.0.1:9000 (`STORAGE_PORT`); file browser http://127.0.0.1:9001 | Files and recordings |
| Fake inbox (Mailpit) | http://127.0.0.1:8025 (`MAILPIT_WEB_PORT`); SMTP 1025 | Every email the app sends lands here; nothing is really sent |
| Backend (runs on the Mac, not in Docker) | http://127.0.0.1:3000 (`API_PORT`) | `/api/v1/health` shows each service as `ok` or `down` |

## Everyday commands
- `pnpm dev`: checks Docker and ports, starts the services, then the backend and the app.
- `pnpm dev:stop`: stops the services. Data is kept.
- `docker compose -f infra/docker-compose.yml --env-file .env ps`: which services run and whether they are healthy.
- `docker compose -f infra/docker-compose.yml --env-file .env logs <service>`: a service's log, e.g. `logs postgres`.

## Problems and fixes
| What you see | Why | Fix |
|---|---|---|
| "Docker isn't running" | Docker Desktop is closed, or still starting | Open Docker Desktop, wait for "Engine running", try again |
| "Port 5432 is in use by another program" | Another program (often your own PostgreSQL, Redis or a web app) uses it | Stop it, or move MeetApp's port in `.env` (e.g. `POSTGRES_PORT=5433`). For `API_PORT` also change `VITE_API_URL` |
| Health shows a service `down` | That container stopped | `docker compose -f infra/docker-compose.yml --env-file .env up -d --wait`; the backend reconnects by itself |
| "set in .env" when starting | A setting is missing from `.env` | `pnpm dev` adds missing settings automatically; or copy the line from `.env.example` |
| "Expected Node 24, found 20" | The terminal uses another Node.js | See [getting-started.md](../getting-started.md) step 2 |
| The first start takes long | Docker downloads the services once (about 2 GB) | Wait; later starts take under 2 minutes |

## Starting over (deletes local data)
Only when you really want an empty database and storage: `docker compose -f infra/docker-compose.yml --env-file .env down -v`. The `-v` removes the volumes, so every local row and file is gone. Without `-v`, `down` keeps the data.

## Related
- Monitoring (status page, dashboards, alerts): [monitoring.md](monitoring.md)
- GitHub checks: [ci.md](ci.md)
