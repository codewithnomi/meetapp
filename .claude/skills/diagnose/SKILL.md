---
name: diagnose
description: Find out what is down or broken and why - checks the status page, health endpoints, logs, metrics, traces and error tracking, then explains the root cause in plain words and fixes it or proposes a fix. Use when the owner says something isn't working, a service is down, the app shows an error, a test suddenly fails, or types "/diagnose".
argument-hint: [what seems wrong]
---

# Diagnose: $ARGUMENTS

Goal: find the **root cause**, not just the symptom, and explain it simply.

1. **What's down?** Check, in this order (see `docs/engineering/operations.md`):
   - the status page (Uptime Kuma) and `GET /api/v1/health`, which tells you which part is down
   - `docker compose ps`, to see which local services are running or restarting
2. **Why?** Look at the evidence for the failing part:
   - **Logs:** Loki in Grafana, or `docker compose logs <service> --tail 200`. Search by the request ID from the error message.
   - **Metrics:** Prometheus/Grafana. Look for spikes in errors, memory, CPU, or a full disk around the failure time.
   - **Traces:** Tempo in Grafana, to see which step in a request failed or was slow.
   - **Errors:** Sentry, if configured (Sentry MCP if connected).
   - **Database:** the Postgres MCP (read-only), for connections, locks and slow queries.
   - **Recent changes:** `git log` since it last worked.
3. **Reproduce** it if possible (a failing test is the best proof).
4. **Explain** to the owner in plain words: what broke, why, and how bad it is (who is affected).
5. **Fix:** small and clearly safe fixes (restart a crashed local service, a config typo) go ahead. Code fixes go through the normal flow: add a failing test, fix, run all tests, commit. Ask before anything risky or destructive.
6. **Prevent:** suggest what would have caught it earlier (a test, an alert, a health check) and add it to a runbook in `docs/runbooks/` if it could happen again.
7. Note the incident in `docs/progress.md`.
