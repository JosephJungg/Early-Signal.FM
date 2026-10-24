# Forecast worker: watches the game date and rewrites forecasts after every Advance Day or reset.
# Uses the same DATABASE_URL / DATABASE_USER / DATABASE_PASSWORD as the API. See DEPLOY.md.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "-u", "forecast_job.py"]
