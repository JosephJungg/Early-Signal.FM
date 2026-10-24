# Deploying to Railway

Three services in one Railway project:

| Service | Source | What it runs |
| --- | --- | --- |
| **Postgres** | Railway database | The game state |
| **app** | this repo, root directory `/` (root `Dockerfile`) | Spring Boot API at `/api` and the built terminal at `/`, one URL |
| **forecasts** | this repo, root directory `/ml` (`ml/Dockerfile`) | `forecast_job.py`, refits after every Advance Day or reset |

The frontend is built into the app image, so it calls `/api` on the same origin: no `VITE_API_URL`, no CORS.

## Before you start

Railway deploys from GitHub through its GitHub app, which has to be allowed on the repo owner's
account. The repo is `JosephJungg/Early-Signal.FM`, so **Joseph** either creates the Railway project,
or installs the Railway GitHub app on his account with access to this repo and invites the team to
the Railway project.

## 1. Create the project and database

1. railway.com → **New Project** → **Deploy from GitHub repo** → `Early-Signal.FM`. This creates the
   **app** service; rename it `app`.
2. In the project: **Create** → **Database** → **PostgreSQL**. Leave its name as `Postgres`.

## 2. Configure the app service

**Variables** (paste exactly; Railway fills in the `${{...}}` references):

```
DATABASE_URL=jdbc:postgresql://${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
DATABASE_USER=${{Postgres.PGUSER}}
DATABASE_PASSWORD=${{Postgres.PGPASSWORD}}
```

The API needs the JDBC form, so don't reference `${{Postgres.DATABASE_URL}}` (that is `postgresql://user:pass@...`).

**Settings**:
- Root directory: `/` (default). Railway finds the root `Dockerfile`.
- Networking → **Generate Domain** (port 8080). This is the URL for the demo.
- Deploy → Healthcheck path: `/api/game`.
- Watch paths: `/backend/**`, `/frontend/**`, `/Dockerfile` (so ML-only commits don't redeploy the app).

First boot creates the tables and seeds 24 artists with 30 days of history (about 10 seconds).

## 3. Add the forecast worker

1. **Create** → **GitHub Repo** → `Early-Signal.FM` again; rename it `forecasts`.
2. Settings → Root directory: `/ml`. Watch paths: `/ml/**`. No domain.
3. Variables: the same three `DATABASE_*` lines as the app.

If it starts before the app has created the tables it exits and Railway restarts it; after that the
logs show `forecasts for 24 artists` on every game-date change.

## 4. Check it

```bash
curl https://<your-domain>/api/game        # {"gameDate":"...","day":30}
curl https://<your-domain>/api/market | head -c 300
```

Open `https://<your-domain>`, log in, press **ADVANCE DAY**: prices move, the event wire fills, and
within a second or two the forecast cone extends again (worker logs show the refit).

## Demo operations

- **Clean slate before judging**: `curl -X POST https://<your-domain>/api/admin/reset` (wipes
  players, trades, forecasts; the worker refills forecasts automatically).
- **Prices only move on Advance Day.** The midnight update is off unless `DAILY_UPDATE_ENABLED=true`.
- **`ADMIN_KEY`** is unset, so anyone with the URL can Advance Day or reset. Setting it means
  rebuilding the frontend with `VITE_ADMIN_KEY` (which ends up in the page's JavaScript anyway), so for
  the demo we leave it off and keep the URL to ourselves.
- **Bots**: run them as another service with root directory `/ml` and a different start command,
  pointing `API_URL` at `https://<your-domain>`.

## Run the production images locally

```bash
docker build -t es-app . && docker build -t es-ml ml
docker run --rm -p 8081:8080 -e DATABASE_URL=jdbc:postgresql://host.docker.internal:5432/earlysignal es-app
docker run --rm -e DATABASE_URL=jdbc:postgresql://host.docker.internal:5432/earlysignal es-ml
```
