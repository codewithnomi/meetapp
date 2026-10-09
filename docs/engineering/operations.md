---
status: draft
updated: 2026-10-09
---

# Running in Production (Operations)

How we know the app is healthy, find problems before users complain, and recover from disasters.

## 1. Monitoring (proposed tools, see decisions log)
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
- `docs/runbooks/` will hold step-by-step guides: "call server overloaded", "AI provider down", "database restore".
- After every serious incident, a short write-up: what happened, why, and what we changed.

## 5. Feature flags & analytics
- **Feature flags:** every risky or unfinished feature ships behind an on/off switch, so it can be enabled for testers first and turned off instantly if something goes wrong.
- **Analytics:** count feature usage (e.g. "Ask AI used 30 times today") with privacy on; never send transcript, chat or personal content. Users can opt out.

## 6. Scaling plan
- Call servers: add more LiveKit servers, spread across regions as users grow. TURN relay enabled (TLS on port 443) so calls work behind company firewalls.
- API and AI workers: stateless, so we just add more copies.
- Load test before every major release: 100-person meeting + many meetings at once (`lk load-test`).
