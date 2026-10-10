# CI runbook: when a GitHub check is red

Start with `/fix-ci`. The "Do not merge" comment on the Pull Request shows, for each failed check, the
lines just before its error. The full logs are under the PR's **Checks** tab.

## Traps found so far (F00 T19)
| Symptom | Cause | Fix |
|---|---|---|
| A test can't find its fixture folder on GitHub but works on the Mac | The folder is named like something `.gitignore` ignores (e.g. `coverage/`), so it was never committed | Rename the folder; check with `git check-ignore -v <file>` |
| The backend container never gets healthy on GitHub | On Linux a container can't reach services that listen on 127.0.0.1 only | The container joins the services' network (`meetapp_default`) and uses their names and inside ports (`tools/container-commands.ts`) |
| A desktop test misses a light/dark switch on GitHub only | Linux runners start slower, so a switch can happen before the app listens | The app re-checks the computer's setting when it starts listening (`followSystemTheme`) |
| A desktop test hangs when closing the app | A test let `shell.openExternal` really open a browser | Desktop tests record "open in browser" instead (`security.spec.ts` beforeEach) |
| Electron opens no window from a VS Code terminal | VS Code sets `ELECTRON_RUN_AS_NODE=1` | All start scripts and tests remove it |

## Rules
- Never skip, delete or loosen a test, rule, threshold or scan to make CI pass.
- A check that is only red on GitHub is still a real failure: reproduce it (same command, same versions; Linux-only problems in a matching Docker image).

## "Docker isn't running" on GitHub (T20)
Right after a runner starts, `docker info` sometimes took longer than 3 s, so `pnpm test` gave up although Docker was there. The check now asks a second time after a timeout (at most 6 s in all); a clear "not running" still fails at once.
