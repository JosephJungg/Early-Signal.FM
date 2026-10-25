"""Plays the bots against each other over many simulated seasons, for the pitch.

    python tournament.py                    # 50 seasons x 30 days
    python tournament.py --seasons 200 --days 20

One live demo is mostly luck; many seasons show which strategy actually holds up.
"""
import argparse
import statistics
import time

from bots import IndexBot, all_bots
from sim import STARTING_CASH, SimMarket, SimTradeError


def play_season(seed: int, days: int) -> dict[str, float]:
    market = SimMarket(seed)
    bots = all_bots()
    for bot in bots:
        market.add_user(bot.name)
    for _ in range(days):
        market.refresh_forecasts()
        for bot in bots:
            for side, ticker, shares in bot.decide(market.view(bot.name)):
                try:
                    market.trade(bot.name, side, ticker, shares)
                except SimTradeError:
                    pass  # same as an API 400: the bot just doesn't get that trade
        market.advance()
    return {bot.name: market.total(bot.name) for bot in bots}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seasons", type=int, default=50)
    ap.add_argument("--days", type=int, default=30, help="Advance Days per season")
    args = ap.parse_args()

    started = time.monotonic()
    results = [play_season(seed, args.days) for seed in range(args.seasons)]
    names = list(results[0])

    print(f"{args.seasons} seasons x {args.days} days, starting with {STARTING_CASH:,.0f} credits "
          f"({time.monotonic() - started:.0f}s)\n")
    print(f"{'bot':<15}{'avg return':>11}{'median':>9}{'worst':>9}{'beat HODL':>12}{'finished 1st':>14}")
    for name in names:
        rets = [r[name] / STARTING_CASH - 1 for r in results]
        beat = sum(r[name] > r[IndexBot.name] for r in results) / len(results)
        first = sum(max(r, key=r.get) == name for r in results) / len(results)
        beat_txt = "-" if name == IndexBot.name else f"{beat:.0%}"
        print(f"{name:<15}{statistics.mean(rets):>11.1%}{statistics.median(rets):>9.1%}{min(rets):>9.1%}"
              f"{beat_txt:>12}{first:>14.0%}")


if __name__ == "__main__":
    main()
