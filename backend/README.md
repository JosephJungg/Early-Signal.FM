# Earlysignal API

Spring Boot 3 (Java 21) + PostgreSQL backend for the fantasy music-investing game.

## Run locally

```bash
docker compose up -d          # Postgres on localhost:5432
./mvnw spring-boot:run        # needs Java 21+; the wrapper downloads Maven itself
./mvnw test                   # integration tests against the same Postgres, schema es_test
```

On first start it creates the tables, seeds 20 fictional artists, and simulates 30 days of
history so charts and events have data immediately. To get back to a clean demo state, call
`POST /api/admin/reset` (wipes players, trades, and forecasts, then reseeds).

## Deploy (Railway or Render)

Set `DATABASE_URL` (JDBC form: `jdbc:postgresql://host:port/db`), `DATABASE_USER`,
`DATABASE_PASSWORD`, and `ADMIN_KEY`. `PORT` is picked up automatically.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | /api/users | `{"username":"josh"}` creates or returns the player (10,000 credits); bots add `"kind":"bot"` or `"ai"` |
| GET | /api/game | current game date and day number |
| GET | /api/market | every artist with quote, genre, history, and forecasts in one call (what the terminal loads) |
| GET | /api/artists | ticker, genre, price, changePct, listeners |
| GET | /api/artists/{id}/history | daily price and listeners |
| GET | /api/artists/{id}/forecast | GPR forecast rows written by the ML job, dated after the game date |
| GET | /api/events?limit=20 | newest first: type, headline, impactPct, day |
| GET | /api/portfolio/{userId} | cash, holdings, total value |
| POST | /api/trades | `{"userId":1,"ticker":"NETT","side":"BUY","shares":10}` |
| GET | /api/transactions/{userId} | newest first |
| GET | /api/leaderboard?limit=50 | ranked by total value, with prevValue and kind |
| POST | /api/admin/advance-day?days=1 | demo button; send `X-Admin-Key` if ADMIN_KEY is set |
| POST | /api/admin/reset | clean demo state; send `X-Admin-Key` if ADMIN_KEY is set |

Errors always return `{"error": "..."}` with a 4xx status, so the terminal can print them as is.

## Rules enforced in TradeService

1% fee on every trade, no buying past your cash, and on buys no artist above 30% of total
portfolio value after the trade. Each trade runs in one transaction with the user row locked.

## Try it

```bash
curl -X POST localhost:8080/api/users -H 'Content-Type: application/json' -d '{"username":"josh"}'
curl localhost:8080/api/market
curl -X POST localhost:8080/api/trades -H 'Content-Type: application/json' \
  -d '{"userId":1,"ticker":"NETT","side":"BUY","shares":50}'
curl -X POST 'localhost:8080/api/admin/advance-day?days=3'
curl localhost:8080/api/leaderboard
```

## For the ML job

Write rows into `forecasts (artist_id, forecast_date, mean, lower, upper)`; upsert on
`(artist_id, forecast_date)`. Use game dates, not real dates: forecast `game_date + 1` through
`game_date + 7` from `game_state`, and rerun after Advance Day. Bots should create users with `"kind": "ai"` or `"kind": "bot"` (hyphens are fine, e.g. `ES-GPR`)
and trade through `POST /api/trades` like any player.
