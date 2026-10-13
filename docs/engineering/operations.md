---
status: draft
updated: 2026-10-11
---

# Running in Production (Operations)

How we know the app is healthy, find problems before users complain, and recover from disasters.

## 0. Monitoring from day one (local, free; part of F00, D027)
The same monitoring runs on the owner's Mac now and on servers later, so we always know **what is down and why**.

| Question | Tool | What you see |
|---|---|---|
| **What is down right now?** | **Gatus** (status page, configured from a file, D030) | A green/red list: Backend, Database, Cache, Call server, File storage, Email (AI worker added in F05). Checked every 30 seconds, with history. |
| **Why is it down / slow?** | **Grafana** dashboards | One "MeetApp overview" dashboard: requests per second, error rate, response time, database connections, cache status, CPU and memory per container (queue length, calls and participants added with F02/F05) |
| Numbers over time (metrics) | **Prometheus** (stores) + **Grafana Alloy** (collects, D041) | The backend's `/metrics`, LiveKit, and Alloy's built-in exporters for PostgreSQL, Redis, containers and the Docker disk. File storage (RustFS) has no metrics; only the status page watches it |
| What happened (logs) | **Loki** | The backend's logs and the MeetApp containers' logs (only the `meetapp` Docker project) in one place, searchable by request ID; emails and secrets masked before they are stored |
| Where a request failed (traces) | **Tempo** + **OpenTelemetry** | Each request's path through backend → database → AI worker, with timings and the failing step |
| Crashes with code location | **Sentry** (free, optional) | Error + stack trace + which release |
| Being told: a service is down | **Gatus** alerts | Email (Mailpit locally) and a Mac notification when a service fails 3 checks in a row (60–90 s), and again when it recovers |
| Being told: errors or disk | **Grafana** alert rules | "Error spike" (over 5% errors in 5 min) and "Disk nearly full" (Docker disk over 85%), same email and notification |

Locally this runs as a Docker **"monitoring" profile**: `pnpm monitoring` starts it, prints the addresses and keeps the Mac notification helper running (`pnpm monitoring:stop` stops it). Logs and traces from the API go to Grafana Alloy, which forwards them to Loki and Tempo; both keep 7 days. How to use it: [runbooks/monitoring.md](../runbooks/monitoring.md). Claude uses the same tools through `/diagnose`.

**Sign-in and account logs (F01):** every request is logged with its request ID, method, status and timing, but never its body. Passwords, codes, session tokens, the desktop sign-in's request id and the secret part of invitation and join links (`/invite/REDACTED`) are hidden in logs, traces and Sentry reports (TC-F01-81, 82). To look into a sign-in problem, ask for the request ID shown in the error ("Reference: …") and search Loki for it. Refused attempts (wrong password, too many codes, rate limits) answer `429 TOO_MANY_ATTEMPTS` with `retryAfterSeconds`; the counters live in Redis for at most 24 hours. Emails go through a BullMQ queue inside the backend: a failed email is retried and never blocks the request.

**Background work inside the backend (F01):** a BullMQ queue in Redis sends the code, invitation and request emails (retried on failure), and a daily job at 03:00 UTC marks requests to join older than 14 days as expired. Both run inside the API process, so they stop and start with it. If Redis can't be reached, emails can't be queued and limits let requests through with a warning in the logs ("rate limits unavailable"): check the status page (Cache), restart Redis with `pnpm dev`, and look in Mailpit (http://127.0.0.1:8025 locally) for emails that should have gone out.

**Local-only risks (accepted for the Mac, revisit before anything runs online):** Alloy is not privileged and has no whole-disk access, but it reads the Docker and containerd sockets, which allow full control of Docker (D041); Grafana opens without a login as a read-only viewer and answers only to 127.0.0.1; Prometheus and the Alloy page have no login; the notification helper listens on 127.0.0.1 only and accepts only JSON from its own address. The database numbers are read with a read-only `meetapp_monitor` login (pg_monitor rights). Every port is bound to 127.0.0.1.

## 1. Monitoring later in production (same tools, plus)
| What | Tool | Example |
|---|---|---|
| App errors and crashes (desktop, web, backend) | **Sentry** | "Join button crashed for 12 users on Windows" |
| Server metrics | **Prometheus + Grafana** (LiveKit exports metrics natively) | CPU, bandwidth, rooms, participants |
| **Call quality** | LiveKit stats → Grafana dashboard | packet loss, jitter, delay per meeting/region |
| Logs | Grafana Loki (or Better Stack) | searchable logs by request ID |
| Uptime | external uptime checker + public status page | "API down" alert within 1 minute |
| AI cost | our own dashboard from recorded usage | cost per meeting / workspace / day |

## 2. Alerts (who gets notified, and how)
- API or call server down → immediate alert (phone/Slack).
- Error rate or call-quality drop above the normal level → alert.
- AI or cloud spending above the daily budget → alert. Hard spending limits are set at each provider.

## 3. Backups & disaster recovery
- Database: automatic daily backups + point-in-time recovery (restore to any minute in the last 7 days).
- File storage: versioning on.
- **A restore is tested every month**; a backup that's never been restored doesn't count.
- Targets: lose at most 5 minutes of data; back online within 4 hours after a major failure.

## 4. Incidents
- `docs/runbooks/` holds step-by-step guides: [local-services.md](../runbooks/local-services.md), [monitoring.md](../runbooks/monitoring.md), [ci.md](../runbooks/ci.md). Later: "call server overloaded", "AI provider down", "database restore".
- After every serious incident, a short write-up: what happened, why, and what we changed.

## 5. Feature flags & analytics
- **Feature flags:** every risky or unfinished feature ships behind an on/off switch, so it can be enabled for testers first and turned off instantly if something goes wrong.
- **Analytics:** count feature usage (e.g. "Ask AI used 30 times today") with privacy on; never send transcript, chat or personal content. Users can opt out.

## 6. Scaling plan
- Call servers: add more LiveKit servers, spread across regions as users grow. TURN relay enabled (TLS on port 443) so calls work behind company firewalls.
- API and AI workers: stateless, so we just add more copies.
- Load test before every major release: 100-person meeting + many meetings at once (`lk load-test`).
