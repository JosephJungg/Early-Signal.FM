"""Writes 7-day GP price forecasts for every artist into the forecasts table.

    python forecast_job.py          # watch the game date and refit whenever it changes
    python forecast_job.py --once   # fit everything once and exit

Each run: estimate each tier's daily drift from all its artists' history, fit a GP per artist
around that drift, add any release boost the engine still owes, and replace that artist's rows
for game_date + 1 .. game_date + 7.
Reruns after Advance Day (game date changes) and after /api/admin/reset (forecasts wiped).
"""
import argparse
import os
import time
from collections import defaultdict
from datetime import timedelta

import numpy as np
import psycopg

import db
import gp

HORIZON = 7
KERNEL = os.environ.get("KERNEL", "ou")
HISTORY_DAYS = 60
MIN_HISTORY = 10


def run(conn) -> None:
    started = time.monotonic()
    today = db.game_date(conn)
    artists = db.artists(conn)
    history = {a["id"]: db.price_history(conn, a["id"], HISTORY_DAYS)[1] for a in artists}

    returns_by_tier = defaultdict(list)
    for a in artists:
        returns_by_tier[a["tier"]].append(np.diff(np.log(history[a["id"]])))
    drift = {tier: gp.tier_drift(r) for tier, r in returns_by_tier.items()}

    dates = [today + timedelta(days=k) for k in range(1, HORIZON + 1)]
    written = 0
    with conn.transaction():  # the frontend sees all 20 cones switch at once
        for a in artists:
            prices = history[a["id"]]
            if len(prices) < MIN_HISTORY:
                print(f"  skip {a['ticker']}: only {len(prices)} days of history")
                continue
            tier_mean, tier_se = drift[a["tier"]]
            mean, lower, upper = gp.forecast(prices, HORIZON, KERNEL, drift=tier_mean, drift_se=tier_se,
                                             boost=a["release_boost"])
            db.replace_forecasts(conn, a["id"], list(zip(dates, mean, lower, upper)))
            written += 1

    tiers = ", ".join(f"{t} {d * 100:+.2f}%/day" for t, (d, _) in sorted(drift.items()))
    print(f"[{today}] forecasts for {written} artists in {time.monotonic() - started:.1f}s (drift: {tiers})")


def watch(interval: float) -> None:
    last_date = None
    while True:
        try:
            with db.connect() as conn:
                print("connected; watching game date")
                while True:
                    today = db.game_date(conn)
                    if today != last_date or not db.has_current_forecasts(conn):
                        run(conn)
                        last_date = today
                    time.sleep(interval)
        except (psycopg.OperationalError, psycopg.errors.UndefinedTable) as e:
            # Backend restarting, Postgres not up yet, or the API hasn't created the tables on a fresh
            # deploy: keep trying rather than dying mid-demo.
            print(f"database unavailable ({str(e).strip().splitlines()[0]}); retrying in 5s")
            time.sleep(5)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true", help="fit once and exit")
    ap.add_argument("--interval", type=float, default=1.0, help="seconds between game-date checks")
    args = ap.parse_args()
    if args.once:
        with db.connect() as conn:
            run(conn)
    else:
        watch(args.interval)


if __name__ == "__main__":
    main()
