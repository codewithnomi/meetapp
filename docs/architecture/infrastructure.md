---
status: accepted (stage 1–2) / proposed (stage 3)
updated: 2026-10-09
---

# Infrastructure Plan

Where MeetApp runs, at each stage. We move to the next stage only when the owner decides (D017).

## Stage 1 (now): everything on the owner's Mac (free)
Owner's machine: Apple M4, 16 GB RAM, macOS 26. Good for development and for local AI (Whisper/Ollama, F12).

| Piece | Runs as | Notes |
|---|---|---|
| Call server (LiveKit) | Docker container | Dev keys, only reachable from this Mac |
| Database (PostgreSQL + pgvector) | Docker container | Data kept in a Docker volume |
| Cache / job queue (Redis) | Docker container | Persistence on, so queued jobs survive restarts |
| File storage (**MinIO**) | Docker container | Works exactly like Cloudflare R2 (same "S3" API), so switching later needs no code change |
| Fake email inbox (**Mailpit**) | Docker container | View every email the app sends |
| Backend API, AI worker | Run directly with hot reload while developing; also built as **container images** (Dockerfiles) so they run the same way online later |
| Desktop app | Electron in development mode | |
| Monitoring (Grafana/Prometheus) | Optional Docker profile, off by default | Turn on when we work on call quality |

**Tool versions are locked** for the whole project with **mise** (one file, `mise.toml`), so every computer and CI uses the same versions:
- **Node.js 24 LTS.** Node 20, currently on the owner's Mac, stopped receiving security updates in April 2026.
- **pnpm**
- **Python 3.12.** AI libraries support it well. Python 3.14 is too new for some of them, and `uv` manages it.

Docker: Docker Desktop is free for personal use and small businesses. OrbStack is a lighter alternative (also free for personal use).

## Stage 2 (when needed): testing calls with real people on other networks
The Mac setup only works on this computer. To test a real call with friends or colleagues elsewhere, before we have our own servers, we have two options:
- **Option A (recommended): LiveKit Cloud free tier.** Only the call server moves to the cloud; everything else stays on the Mac. Free within its monthly limits. Needs a free LiveKit account (the owner creates it).
- **Option B: one small rented server** (~€5–10/month), which is basically a preview of Stage 3.

Ask the owner before doing either.

## Stage 3 (later): online for real users (proposed, decided when going live)
```
Users ──► Cloudflare (DNS, HTTPS, protection; free) ──► API servers (containers)
  │                                                     ├─► PostgreSQL (+ PgBouncer, daily backups)
  │                                                     ├─► Redis (job queue)
  │                                                     ├─► AI workers (containers; GPU optional)
  │                                                     └─► Cloudflare R2 (files)
  └── audio/video ──► LiveKit servers (+ TURN on port 443), close to users
Desktop updates ──► GitHub Releases (free)
Container images ──► GitHub Container Registry (free)
```
| Topic | Plan |
|---|---|
| Hosting | **Hetzner** (cheap, generous bandwidth, which is the main cost of video) for LiveKit and app servers; more regions as users grow |
| Domain, DNS, HTTPS | Buy a domain (~$10–15/year); Cloudflare free plan for DNS, HTTPS certificates and attack protection |
| Infrastructure as code | **OpenTofu** (free) describes all servers in files, so they can be rebuilt exactly and changes are reviewed in Pull Requests |
| Deploying | CI builds container images, then deploys to staging automatically and to production with one approval |
| Secrets | GitHub encrypted secrets for CI; a secrets manager (e.g. Infisical, open source) for servers |
| Database | Start self-managed with automatic backups + point-in-time restore; move to managed Postgres when revenue allows |
| Monitoring | operations.md: Sentry, Grafana, uptime checks, status page |

### Rough monthly cost at small scale (estimates; check prices when the time comes)
| Item | Approx. cost |
|---|---|
| Call server(s) + app server (Hetzner) | €20–60 / month |
| Domain | ~$1 / month |
| Cloudflare, R2 (first 10 GB), Sentry, GitHub, GHCR | free tiers |
| Apple Developer (Mac app signing) | $99 / year |
| Windows code signing (e.g. Azure Trusted Signing) | ~$10 / month |
| Speech-to-text (Deepgram) | pay per audio minute |
| AI (Claude) | pay per use; prompt caching and Haiku for simple tasks keep it low |

## GitHub limits to keep in mind (free plan, private repo)
- **2,000 CI minutes/month.** Linux runners count 1×, Windows 2×, macOS 10×. So most checks run on Linux; Windows runs once a day; macOS only for releases.
- **Branch protection is not available** on private repos on the free plan, so we follow the "no direct commits to `main`" rule ourselves (CLAUDE.md).
