# Earlysignal API

Backend for the Earlysignal hackathon game: players trade fictional music artists like stocks with
fake credits. Spring Boot 3.3 (Java 21), plain JdbcTemplate (no JPA), PostgreSQL. One app, no
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
| POST | /api/users | `{"username","isBot"?}` 3-20 chars `[A-Za-z0-9_]` | `{id,username,cash,isBot}`; creates or returns |
| GET | /api/game | | `{gameDate}` |
| GET | /api/artists | | `[{id,ticker,name,tier,price,changePct,listeners}]` sorted by ticker |
| GET | /api/artists/{id}/history | | `[{date,price,listeners}]` oldest first |
| GET | /api/artists/{id}/forecast | | `[{date,mean,lower,upper}]`, only dates after the game date |
| GET | /api/events | `limit` (default 20, max 200) | `[{id,artistId,ticker,type,message,date}]` newest first |
| GET | /api/portfolio/{userId} | | `{userId,username,cash,holdingsValue,totalValue,holdings:[{artistId,ticker,shares,avgCost,price,value}]}` |
| POST | /api/trades | `{userId, ticker or artistId, side:"BUY"/"SELL", shares}` | `{transactionId,side,ticker,shares,price,fee,cash}` |
| GET | /api/transactions/{userId} | | `[{id,artistId,ticker,side,shares,price,fee,gameDate,createdAt}]` newest first |
| GET | /api/leaderboard | `limit` (default 50, max 500) | `[{rank,userId,username,totalValue,isBot}]` |
| POST | /api/admin/advance-day | `days` (1-30), header `X-Admin-Key` if `ADMIN_KEY` set | `[{gameDate,artistsUpdated,events}]` |
| POST | /api/admin/reset | header `X-Admin-Key` if `ADMIN_KEY` set | `{gameDate}` |

Tiers: `BLUE_CHIP`, `MID`, `UNDERGROUND`. Event types: `NEW_RELEASE`, `VIRAL_SPIKE`, `LISTENER_DROP`.

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
- Dates are game dates: read `SELECT game_date FROM game_state WHERE id = 1` and write
  `game_date + 1` through `game_date + 7`. Rerun after Advance Day. The API hides rows on or
  before the game date.
- `/api/admin/reset` truncates forecasts too; artist ids restart at 1 in seed order, so just rerun.

## Bots

Create the user with `"isBot": true`, then trade through `POST /api/trades` like any player.
Bots never write to the database directly.

## Deploy (Railway or Render)

Env vars: `DATABASE_URL` in JDBC form (`jdbc:postgresql://host:port/db`, not the `postgres://`
URL the host gives you), `DATABASE_USER`, `DATABASE_PASSWORD`, `ADMIN_KEY`. `PORT` is automatic.
Set `game.daily-update-enabled=false` for the demo so only Advance Day moves prices.
