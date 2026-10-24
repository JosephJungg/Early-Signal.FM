# EarlySignal.FM

- `frontend/` React terminal UI (`npm --prefix frontend run dev`, port 5173)
- `backend/` Spring Boot + PostgreSQL API (`cd backend && docker compose up -d && ./mvnw spring-boot:run`, port 8080).
  See [backend/README.md](backend/README.md) for endpoints and [backend/CLAUDE.md](backend/CLAUDE.md) for the API contract.
- `ml/` Python GP forecast job (`cd ml && python forecast_job.py`)

Deploying: see [DEPLOY.md](DEPLOY.md) (Railway: one app service serving API + terminal, Postgres, forecast worker).
