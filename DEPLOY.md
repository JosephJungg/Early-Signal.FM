# Deploying to Render (free tier)

Two pieces, both free:

| Render resource | What it runs |
| --- | --- |
| **Postgres** (Free) | The game state. Free databases expire after 30 days, fine for the hackathon. |
| **Web Service** (Free, Docker) | One container from the root `Dockerfile`: Spring Boot serves the API at `/api` and the built terminal at `/`, and the GP forecast job runs alongside it (`start.sh`). |

Same origin, so the frontend needs no `VITE_API_URL` and the API needs no CORS. The container fits the
free 512 MB instance (about 230 MB in use when tested).

The repo is public, so Render deploys it straight from its URL: nothing to install on Joseph's GitHub.

## 1. Create the database

1. render.com → sign in → **New +** → **Postgres**.
2. Name `earlysignal-db`, pick a region (remember it), Instance type **Free** → **Create Database**.
3. When it's available, copy the **Internal Database URL** from its page
   (`postgresql://user:password@dpg-.../earlysignal_db`).

## 2. Create the web service

1. **New +** → **Web Service** → **Public Git Repository** →
   `https://github.com/JosephJungg/Early-Signal.FM` → **Connect**.
2. Name `earlysignal`, **same region as the database**, branch `main`, language **Docker**,
   instance type **Free**.
3. Environment variables: `DATABASE_URL` = the Internal Database URL from step 1.
   (The app and the forecast job both accept that `postgresql://user:pass@host/db` form.)
4. Advanced → Health Check Path: `/api/game`.
5. **Create Web Service**. The first build takes several minutes; the URL is shown at the top
   (`https://earlysignal-xxxx.onrender.com`).

First boot creates the tables and seeds 24 artists with 30 days of history; the logs then show
`forecasts for 24 artists`.

## 3. Check it

```bash
curl https://<your-url>/api/game        # {"gameDate":"...","day":30}
```

Open `https://<your-url>`, log in, press **ADVANCE DAY**: prices move, the event wire fills, and a
few seconds later the forecast cone extends again (logs show the refit).

## Things to know

- **New commits don't deploy themselves** (public-repo services have no GitHub hook). After merging,
  click **Manual Deploy → Deploy latest commit** on the service.
- **Free services sleep after 15 minutes without traffic** and take about a minute to wake. Open the
  URL a few minutes before judging, or point a free uptime monitor at `/api/game` every 5 minutes.
- **Clean slate before judging**: `curl -X POST https://<your-url>/api/admin/reset` (wipes players,
  trades, forecasts; the bundled worker refills forecasts within seconds).
- **Prices only move on Advance Day.** The midnight update is off unless `DAILY_UPDATE_ENABLED=true`.
- **`ADMIN_KEY`** is unset, so anyone with the URL can Advance Day or reset. Setting it means
  rebuilding the frontend with `VITE_ADMIN_KEY` (which ends up in the page's JavaScript anyway), so for
  the demo we leave it off and keep the URL to ourselves.
- **Bots** (`ES-GPR`, `HODL-BOT`, `MOMENTUM-BOT`, `RANDOM-BOT`) run inside the same container:
  `ml/runner.py` refits forecasts after each Advance Day, then each bot takes one turn through the
  API. Set `BOTS=off` on the service to keep forecasts but stop the bots.
- **Separate worker** (on a host with paid workers): set `FORECAST_WORKER=off` on the web service and
  run `ml/Dockerfile` as its own service with the same `DATABASE_URL` plus `API_URL=https://<your-url>`.

## Run the production image locally

```bash
docker build -t earlysignal .
docker run --rm -p 8081:8080 --memory=512m \
  -e DATABASE_URL=postgresql://earlysignal:earlysignal@host.docker.internal:5432/earlysignal earlysignal
```
