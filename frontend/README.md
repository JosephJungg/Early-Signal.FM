# EarlySignal Terminal (frontend)

React + Vite + Lightweight Charts. Talks to the Spring Boot API in `backend/`.

## Run

```bash
# 1. backend (see backend/README.md): Postgres + ./mvnw spring-boot:run  → localhost:8080
# 2. frontend
cd frontend
npm install
npm run dev        # http://localhost:5173, /api is proxied to localhost:8080
```

No backend? Click **Play with practice data instead** on the login or error screen, or start with
`VITE_DATA_SOURCE=mock npm run dev`. The mock runs in the browser with the same endpoints,
response shapes and trade rules as the real API.

## Settings (env vars)

| Var | Use |
| --- | --- |
| `VITE_API_PROXY` | Dev only: send `/api` to a different backend, e.g. the deployed one |
| `VITE_API_URL` | Production build: full API origin, e.g. `https://earlysignal-api.up.railway.app` |
| `VITE_ADMIN_KEY` | Sent as `X-Admin-Key` on Advance Day when the backend has `ADMIN_KEY` set |
| `VITE_DATA_SOURCE=mock` | Start on mock data |

## Where things live

- `src/api/client.js`: every API call, one function per endpoint
- `src/api/mockApi.js`: in-browser fake of the same API
- `src/useTerminal.js`: loads and polls data (every 15s), trade and Advance Day actions
- `src/trading.js`: fee and 30% cap math for the order ticket preview (the server has the final say)
- `src/Terminal.jsx`: layout, command line, keyboard shortcuts, trade feedback
- `src/components/Guide.jsx`: the how-to-play screen (shown on first visit, F1 any time)
- `src/components/DayRecap.jsx`: the summary card after each Advance Day
- `src/components/`: panels

Leaderboard tags come from each player's `kind` in the API: `ai` shows a cyan **AI** tag, `bot` shows **BOT**.

Layouts: full 4-column grid above 1600px wide; 3 columns from 1101–1600px (leaderboard and news move
into the portfolio panel as tabs, so a 1366×768 projector fits); stacked and scrollable below that.
