"""Writes 7-day GP price forecasts for every artist into the forecasts table.

    python forecast_job.py          # watch the game date and refit whenever it changes
    python forecast_job.py --once   # fit everything once and exit

Each run: estimate every artist's growth rate from its listener history (shrunk toward the
market average), fit a GP to its prices around that trend, and replace that artist's rows for
game_date + 1 .. game_date + 7.
Reruns after Advance Day (game date changes) and after /api/admin/reset (forecasts wiped).
"""
import argparse
import os
import time
from datetime import timedelta

import numpy as np
import psycopg

import db
import gp

HORIZON = 7
KERNEL = os.environ.get("KERNEL", "ou")
HISTORY_DAYS = 60
MIN_HISTORY = 10
LISTENER_WEIGHT = 0.8  # PriceEngine: daily log-return = 0.8 x listener growth + noise + events
LISTENER_TRIM = 0.1    # drop the top and bottom 10% of daily listener changes (event days)


def price_drifts(artists: list[dict]) -> dict:
    """key -> (expected daily log-return, standard error) for each artist.

    Growth is estimated from listeners, not prices: the engine grows listeners at each artist's
    rate with about half the noise prices get, and moves price by LISTENER_WEIGHT x listener
    growth plus noise and event jumps that are the same for everyone on average. So an artist's
    price drift = the market's average price return + LISTENER_WEIGHT x how much faster than
    average its listeners grow. In backtests this ranks artists by true growth about twice as
    well as using prices.
    """
    listener = gp.artist_drifts({a["key"]: np.diff(np.log(a["listeners"])) for a in artists}, trim=LISTENER_TRIM)
    if not listener:
        return {}
    market_listener = float(np.mean([d for d, _ in listener.values()]))
    market_price = float(np.mean(np.concatenate([np.diff(np.log(a["prices"])) for a in artists])))
    return {k: (market_price + LISTENER_WEIGHT * (d - market_listener), LISTENER_WEIGHT * se)
            for k, (d, se) in listener.items()}


def forecast_all(artists: list[dict]) -> tuple[dict, dict]:
    """artists: [{key, prices, listeners}] (same days, oldest first). Returns
    (key -> (mean, lower, upper), key -> (drift, se)) for every artist with enough history.
    Shared by the live job and the offline tournament."""
    usable = [a for a in artists if len(a["prices"]) >= MIN_HISTORY]
    drifts = price_drifts(usable)
    out = {}
    for a in usable:
        drift, se = drifts[a["key"]]
        out[a["key"]] = gp.forecast(a["prices"], HORIZON, KERNEL, drift=drift, drift_se=se)
    return out, drifts


def run(conn) -> None:
    started = time.monotonic()
    today = db.game_date(conn)
    artists = []
    for a in db.artists(conn):
        _, prices, listeners = db.history(conn, a["id"], HISTORY_DAYS)
        artists.append({"key": a["id"], "ticker": a["ticker"], "prices": prices, "listeners": listeners})
    forecasts, drifts = forecast_all(artists)
    for a in artists:
        if a["key"] not in forecasts:
            print(f"  skip {a['ticker']}: only {len(a['prices'])} days of history")

    dates = [today + timedelta(days=k) for k in range(1, HORIZON + 1)]
    with conn.transaction():  # the frontend sees all cones switch at once
        for artist_id, (mean, lower, upper) in forecasts.items():
            db.replace_forecasts(conn, artist_id, list(zip(dates, mean, lower, upper)))

    ticker = {a["key"]: a["ticker"] for a in artists}
    ranked = sorted(drifts.items(), key=lambda kv: -kv[1][0])
    top = ", ".join(f"{ticker[k]} {d * 100:+.2f}%" for k, (d, _) in ranked[:3])
    print(f"[{today}] forecasts for {len(forecasts)} artists in {time.monotonic() - started:.1f}s "
          f"(fastest drift/day: {top})")


def watch(interval: float) -> None:
    last_date = None
    while True:
        try:
            with db.connect() as conn:
                print("connected; watching game date")
                while True:
                    today = db.game_date(conn)
                    if today is None:  # tables exist but the API hasn't seeded the game yet
                        time.sleep(interval)
                        continue
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
