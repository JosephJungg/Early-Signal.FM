# EarlySignal.FM

- `frontend/` React terminal UI (`npm --prefix frontend run dev`, port 5173)
- `backend/` Spring Boot + PostgreSQL API (`cd backend && docker compose up -d && ./mvnw spring-boot:run`, port 8080).
  See [backend/README.md](backend/README.md) for endpoints and [backend/CLAUDE.md](backend/CLAUDE.md) for the API contract.
- `ml/` Python GP forecasts and bots (`cd ml && python runner.py`; `python tournament.py` for the bot tournament)

Deploying: see [DEPLOY.md](DEPLOY.md) (Render free tier: one container serving API + terminal + forecast job, plus Postgres).
