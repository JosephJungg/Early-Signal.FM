#!/bin/sh
# Container entrypoint: forecast worker in the background (restarted if it ever exits), API in front.
# Set FORECAST_WORKER=off when the worker runs as its own service instead (ml/Dockerfile).
if [ "${FORECAST_WORKER:-on}" != "off" ]; then
  (cd ml && while true; do python -u forecast_job.py; echo "forecast worker exited; restarting in 5s"; sleep 5; done) &
fi
exec java $JAVA_OPTS -jar app.jar
