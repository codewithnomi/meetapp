# Runbook: local monitoring

Optional. It shows what is up or down, live numbers, logs and traces, and sends alerts. Everything is free and runs only on this Mac (design.md section 3, decisions D030 and D041).

## Start and stop
- `pnpm monitoring` starts it (and the normal services if they aren't running), prints the addresses, then keeps running to show **Mac notifications** for alerts. Keep that window open; Ctrl+C closes only the notifications (alert emails keep working).
- `pnpm monitoring:stop` stops the monitoring containers. Their data is kept.
- To see the backend's **logs and traces**, set `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318` in `.env` and restart `pnpm dev`.

## Where to look
| What | Address | Use it for |
|---|---|---|
| Status page (Gatus) | http://127.0.0.1:8080 | Green/red for Backend, Database, Cache, Call server, File storage, Email. Checked every 30 s |
| Dashboards (Grafana) | http://127.0.0.1:3001 | "MeetApp overview": requests, errors, response time, database connections, cache, CPU/memory per container. Opens without a login (read-only); admin password is `GRAFANA_ADMIN_PASSWORD` in `.env` |
| Alert emails (Mailpit) | http://127.0.0.1:8025 | The "down" and "recovered" emails |
| Metrics (Prometheus) | http://127.0.0.1:9090 | Raw numbers, for debugging |
| Collector (Alloy) | http://127.0.0.1:12345 | Whether each collection step is healthy |

All ports can be moved in `.env` (`GATUS_PORT`, `GRAFANA_PORT`, `PROMETHEUS_PORT`, `ALLOY_OTLP_PORT`, `ALLOY_UI_PORT`, `NOTIFIER_PORT`).

## Alerts
- **"<service> is down":** that service failed 3 checks in a row (down for over a minute). A "recovered" alert follows when it is back. A blip under 30 s never alerts.
- **"Error spike":** more than 5% of the backend's answers were errors over 5 minutes. Open the dashboard, then Grafana → Explore → Loki and search for the error's request ID.
- **"Disk nearly full":** Docker's disk is over 85% full. `docker system prune` removes unused images.

## Find what happened to one request
Every error answer carries a `requestId`. In Grafana → Explore → Loki, run `{service_name="meetapp-api"} | requestId="<the id>"`. The log line has a "Open trace" link to the request's trace in Tempo, which shows which step failed.

## Checking that monitoring works
`pnpm test:monitoring` (about 20 minutes, keeps the Mac awake while it runs) stops each service in turn and checks the status page, the dashboard, logs, traces and the alerts. It needs Docker, and `pnpm dev` and `pnpm monitoring` must be closed first (it starts its own backend and notifier).

## Privacy
Only MeetApp's own containers are read. Other programs you run in Docker are never collected (D041).
