#!/bin/sh
# Container entrypoint: ML runner in the background (restarted if it ever exits), API in front.
# The runner refits forecasts after every Advance Day or reset, then the bots take one turn each
# through this container's own API. BOTS=off keeps the forecasts but skips the bots.
# Set FORECAST_WORKER=off when the runner runs as its own service instead (ml/Dockerfile).
if [ "${FORECAST_WORKER:-on}" != "off" ]; then
  export API_URL="${API_URL:-http://localhost:${PORT:-8080}}"
  (cd ml && while true; do python -u runner.py; echo "ml runner exited; restarting in 5s"; sleep 5; done) &
fi
exec java $JAVA_OPTS -jar app.jar
