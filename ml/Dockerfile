# ML runner as its own service: refits forecasts after every Advance Day or reset, then the bots
# trade. Uses the same DATABASE_URL as the API, plus API_URL=https://<app-url> for the bots
# (BOTS=off to skip them). See DEPLOY.md.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "-u", "runner.py"]
