"""The one process to run next to the API during the game:

    python runner.py                 # forecasts + all bots, every time the game date changes
    python runner.py --no-bots       # forecasts only
    python runner.py --bots ES-GPR,HODL-BOT

Each new game day: refit forecasts (straight into Postgres), then every bot takes one turn
through the public API, so the AI bot always trades on today's forecasts.
Needs DATABASE_URL (forecasts) and API_URL (bots); both default to localhost.
BOTS=off in the environment does the same as --no-bots (used by start.sh).
"""
import argparse
import os
import time

import psycopg
import requests

import api
import db
import forecast_job
import live
from bots import all_bots


def run_bots(bots) -> None:
    snap = live.market_snapshot()
    for bot in bots:
        orders = live.take_turn(bot, snap)
        print(f"  {bot.name:<14} {', '.join(orders) if orders else 'no trades'}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-bots", action="store_true", help="only write forecasts")
    ap.add_argument("--bots", help="comma-separated bot names to run (default: all)")
    ap.add_argument("--interval", type=float, default=1.0, help="seconds between game-date checks")
    args = ap.parse_args()

    bots = [] if args.no_bots or os.environ.get("BOTS", "on") == "off" else all_bots()
    if args.bots:
        wanted = set(args.bots.split(","))
        bots = [b for b in bots if b.name in wanted]
    print(f"bots: {', '.join(b.name for b in bots) or 'none'}")

    forecast_date = bot_date = None
    while True:
        try:
            with db.connect() as conn:
                print("connected to database; watching game date")
                while True:
                    today = db.game_date(conn)
                    if today is None:  # tables exist but the API hasn't seeded the game yet
                        time.sleep(args.interval)
                        continue
                    fresh = db.has_current_forecasts(conn)
                    if today != forecast_date or not fresh:
                        forecast_job.run(conn)
                        forecast_date = today
                        if not fresh:
                            bot_date = None  # a reset wipes users too, so bots start over
                    if bots and bot_date != today:
                        try:
                            run_bots(bots)
                            bot_date = today
                        except (api.ApiError, requests.RequestException) as e:
                            # API down or restarting: try again next tick, forecasts keep going.
                            print(f"  bots skipped: {e}")
                            time.sleep(5)
                    time.sleep(args.interval)
        except (psycopg.OperationalError, psycopg.errors.UndefinedTable) as e:
            # Postgres not up yet, or the API hasn't created the tables on a fresh deploy.
            print(f"database not ready ({str(e).strip().splitlines()[0]}); retrying in 5s")
            time.sleep(5)


if __name__ == "__main__":
    main()
