# Earlysignal API

Backend for the Earlysignal hackathon game: players trade real artists (names only; prices, listeners and news are
simulated) like stocks with fake credits. Spring Boot 3.3 (Java 21), plain JdbcTemplate (no JPA), PostgreSQL. One app, no
microservices.

Team: Joshua (this API, database, deploy), Matthew (React terminal frontend), Joseph (Python ML
job writing forecasts, plus bots trading through the public API).

## Commands

```bash
docker compose up -d     # Postgres on localhost:5432 (needed for the app and the tests)
./mvnw spring-boot:run   # API on localhost:8080
./mvnw test              # integration tests, in their own es_test schema
```

## Layout

- `api/` controller, DTO records (`Dtos.java` is the contract), error handling
- `service/` `TradeService` (writes), `MarketService` (reads)
- `engine/` `PriceEngine` (one game day), `DataSeeder` (first start and reset), `DailyScheduler`
- `resources/schema.sql` runs on every start; keep it `CREATE ... IF NOT EXISTS`

## API contract

Changing a shape in `Dtos.java` breaks the frontend and the bots: tell the team first.
Every error is `{"error": "..."}` with a 4xx status (5xx only for real server bugs).

| Method | Path | Body or params | Returns |
| --- | --- | --- | --- |
| POST | /api/users | `{"username","kind"?,"isBot"?}` 3-20 chars `[A-Za-z0-9_-]`; kind `human`/`bot`/`ai` | `{id,username,cash,isBot,kind}`; creates or returns |
| GET | /api/game | | `{gameDate,day}` |
| GET | /api/market | | `{gameDate,day,artists:[{id,ticker,name,genre,tier,price,change,changePct,listeners,listenersChangePct,history:[...],forecast:[...]}]}` sorted by ticker. One call for the whole terminal. |
| GET | /api/artists | | `[{id,ticker,name,genre,tier,price,changePct,listeners}]` sorted by ticker |
| GET | /api/artists/{id}/history | | `[{date,day,price,listeners}]` oldest first |
| GET | /api/artists/{id}/forecast | | `[{date,day,mean,lower,upper}]`, only dates after the game date |
| GET | /api/events | `limit` (default 20, max 200) | `[{id,artistId,ticker,type,headline,impactPct,date,day}]` newest first |
| GET | /api/portfolio/{userId} | | `{userId,username,cash,holdingsValue,totalValue,holdings:[{artistId,ticker,shares,avgCost,price,value}]}` |
| POST | /api/trades | `{userId, ticker or artistId, side:"BUY"/"SELL", shares}` | `{transactionId,side,ticker,shares,price,fee,cash}` |
| GET | /api/transactions/{userId} | | `[{id,artistId,ticker,side,shares,price,fee,gameDate,day,createdAt}]` newest first |
| GET | /api/leaderboard | `limit` (default 50, max 500) | `[{rank,userId,username,kind,isBot,totalValue,prevValue}]` |
| POST | /api/admin/advance-day | `days` (1-30), header `X-Admin-Key` if `ADMIN_KEY` set | `[{gameDate,day,artistsUpdated,events}]` |
| POST | /api/admin/reset | header `X-Admin-Key` if `ADMIN_KEY` set | `{gameDate,day}` |

- `day` counts game days from the first seeded history day (day 0), so a fresh seed starts at day 30.
- Event types (with `impactPct` ranges, the shock added to that day's return): `VIRAL SPIKE` +15..40,
  `PLAYLIST ADD` +5..12, `TOUR ANNOUNCED` +3..8, `LABEL SIGNING` +6..15, `COLLAB DROP` +4..10,
  `ALBUM DELAY` -10..-4, `COLD STREAK` -25..-10. Same list as the frontend mock; defined in `PriceEngine`.
- `prevValue` is cash plus holdings at yesterday's prices, for the leaderboard 1D column.
- `forecast` holds only the ML rows (day+1 to day+7); the frontend prepends today's price for the cone.
- Tiers: `BLUE_CHIP` (5M+ listeners), `MID` (1M+), `UNDERGROUND`. The 35-artist roster matches
  `frontend/src/api/mockApi.js` and `ml/synthetic.py`.

## Game rules (TradeService)

- 10,000 starting credits, 1% fee on every buy and sell, whole shares only.
- Buys can't exceed cash, and after a buy no single artist can be over 30% of total portfolio value.
- Each trade is one transaction with the user row locked (`FOR UPDATE`) and the artist `FOR SHARE`,
  so Advance Day waits for in-flight trades.
- Settings live in `application.properties` under `game.*`.

## Forecasts table (written by the ML job)

```sql
forecasts (artist_id BIGINT, forecast_date DATE, mean, lower, upper NUMERIC(12,2))
-- primary key (artist_id, forecast_date): upsert with ON CONFLICT
```

- Forecast prices, not listeners, so the cone sits on the price chart.
- `lower`/`upper` are a 90% interval (mean ± 1.645 sd), matching the frontend's "90% CONE" legend.
- Dates are game dates: read `SELECT game_date FROM game_state WHERE id = 1` and write
  `game_date + 1` through `game_date + 7`. Rerun after Advance Day. The API hides rows on or
  before the game date.
- `/api/admin/reset` truncates forecasts too; artist ids restart at 1 in seed order, so just rerun.

## Bots

Create the user with `"kind": "ai"` (the GPR bot) or `"kind": "bot"` (simple bots), using the
frontend's names (`ES-GPR`, `MOMENTUM-BOT`, `RANDOM-BOT`, `HODL-BOT`), then trade through
`POST /api/trades` like any player.
Bots never write to the database directly.

## Deploy (Render free tier)

Env vars: `DATABASE_URL` (JDBC form plus `DATABASE_USER` / `DATABASE_PASSWORD`, or Render's
`postgresql://user:pass@host/db` on its own), optional `ADMIN_KEY`. `PORT` is automatic.
The midnight price update is off by default (`DAILY_UPDATE_ENABLED=true` turns it on), so only
Advance Day moves prices. In production the root `Dockerfile` bundles the built frontend into
`static/` and runs the ML runner (forecasts, then bots) in the same container (`start.sh`), so one URL serves everything.
DATABASE_URL may be JDBC or Render-style `postgresql://user:pass@host/db` (see `config/DatabaseUrl`). Full steps: [DEPLOY.md](../DEPLOY.md).
