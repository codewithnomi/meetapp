# Getting started

How to run MeetApp on a Mac, from nothing to the app window. Everything here is free; no account or credit card is needed (AC-F00-06, AC-F00-25).

## What you need
- **A Mac** with macOS 14 or newer.
- **Docker Desktop** (free for personal use): https://www.docker.com/products/docker-desktop/. Install it, open it once and wait until it says "Engine running". About 8 GB of free disk space is needed: the first start downloads about 2 GB of services, and their data and caches grow from there.
- **Git** (comes with the Xcode command-line tools: run `xcode-select --install` once).
- **mise**, which installs the exact Node.js, pnpm and Python versions this project uses (step 2). You don't need to install Node.js or pnpm yourself.

## 1. Get the code
```sh
git clone https://github.com/codewithnomi/meetapp.git
cd meetapp
```

## 2. Install the tool versions
```sh
curl https://mise.run | sh
echo 'eval "$(~/.local/bin/mise activate zsh)"' >> ~/.zshrc
```
Close the terminal and open a new one, go back into the `meetapp` folder, then:
```sh
mise trust
mise install
```
The `eval` line must be the **last** line of `~/.zshrc`. If another tool there also manages Node.js (for example nvm), MeetApp would otherwise run on the wrong version and `pnpm dev` would stop with "Expected Node 24, found 20. Run `mise install`".

Check: `node -v` prints `v24…` inside the `meetapp` folder.

## 3. Install the project's libraries
```sh
pnpm install
```

## 4. Start everything
Make sure Docker Desktop is running, then:
```sh
pnpm dev
```
The first time, Docker downloads the services (a few minutes). After that it takes under 2 minutes. You get:
- a table with the address of every service,
- the MeetApp window with the starter home screen.

On the first run `pnpm dev` creates your settings file `.env` from `.env.example` and says so. Later updates may add settings; `pnpm dev` adds any missing ones to `.env` and tells you. `.env` holds local passwords, so `pnpm dev` makes it readable only by you.

**Stop:** close the window and press Ctrl+C in the terminal. `pnpm dev:stop` stops the services; your data is kept.

## Signing in for the first time
The app opens on **Sign in**. Choose **Create an account**: the 6-digit code arrives in the fake inbox at http://127.0.0.1:8025 (nothing is really sent). Or run `pnpm seed` and sign in as `owner@example.test` with the password `meetapp-dev-password`: the example accounts are listed in [runbooks/local-services.md](runbooks/local-services.md).

The sign-in settings in `.env` work as they are on your Mac:
- `BETTER_AUTH_SECRET` and `DATA_ENCRYPTION_KEY` (at least 32 characters each) protect sessions and stored secrets; they must be changed before anything runs online.
- `SUPPORT_EMAIL` is the address shown under "Your data" in Settings.
- `APP_PUBLIC_URL` is where invitation and join links point.
- `GOOGLE_*` and `MICROSOFT_*` stay empty unless you want the Google/Microsoft buttons; how to get the keys is in [runbooks/sign-in-providers.md](runbooks/sign-in-providers.md).

## 5. Check that everything works
```sh
pnpm test
```
It runs every automated test (about 5 minutes) and ends with "All tests passed." MeetApp windows open and close by themselves during the desktop tests; leave them alone.

## Useful commands
| Command | What it does |
|---|---|
| `pnpm dev` | Starts the services, the backend and the desktop app |
| `pnpm dev:stop` | Stops the services (data kept) |
| `pnpm desktop` | Opens only the app window, without the services |
| `pnpm test` | Every test |
| `pnpm check` | Code-quality checks |
| `pnpm monitoring` | Status page, dashboards and alerts (see [runbooks/monitoring.md](runbooks/monitoring.md)) |
| `pnpm seed` / `pnpm seed:clear` | Add / remove sample data (example accounts, password `meetapp-dev-password`: see `docs/runbooks/local-services.md`) |
| `pnpm flag list` | Show the feature switches; `pnpm flag <key> on` or `off` changes one |
| `pnpm email:test` | Sends a test email to the fake inbox (http://127.0.0.1:8025) |

## When something goes wrong
- **"Docker isn't running"**: open Docker Desktop and wait for "Engine running".
- **"Port 5432 is in use by another program"** (or another port): another program on your Mac uses it, for example your own PostgreSQL, Redis or a web app. Either stop that program, or give MeetApp a different port in `.env`, for example `POSTGRES_PORT=5433`, `REDIS_PORT=6380`, `API_PORT=3010` (then also `VITE_API_URL=http://127.0.0.1:3010`).
- **"Expected Node 24"**: step 2 isn't finished. Run `mise install`, and check that the `eval` line is the last line of `~/.zshrc`.
- **Something else:** see [runbooks/local-services.md](runbooks/local-services.md), or ask Claude to run `/diagnose`.
