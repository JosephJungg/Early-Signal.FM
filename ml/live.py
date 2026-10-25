"""Runs the bots against the real game through the public API, like any player."""
import api
from bots import Bot, View


def market_snapshot() -> dict:
    """Market data shared by every bot this turn, from one /api/market call."""
    m = api.market()
    snap = {"date": m["gameDate"], "prices": {}, "tiers": {}, "history": {}, "forecasts": {}}
    for a in m["artists"]:
        t = a["ticker"]
        snap["prices"][t] = float(a["price"])
        snap["tiers"][t] = a["tier"]
        snap["history"][t] = [float(p["price"]) for p in a["history"]]
        if a.get("forecast"):
            snap["forecasts"][t] = {k: [float(p[k]) for p in a["forecast"]] for k in ("mean", "lower", "upper")}
    return snap


def take_turn(bot: Bot, snap: dict) -> list[str]:
    """Creates the bot's user if needed (also after a reset), decides, and places its orders."""
    user = api.create_user(bot.name, kind=bot.kind)
    pf = api.portfolio(user["id"])
    view = View(date=snap["date"], prices=snap["prices"], tiers=snap["tiers"], history=snap["history"],
                forecasts=snap["forecasts"], cash=float(pf["cash"]),
                holdings={h["ticker"]: h["shares"] for h in pf["holdings"]})
    log = []
    for side, ticker, shares in bot.decide(view):
        try:
            api.trade(user["id"], ticker, side, shares)
            log.append(f"{side} {ticker} {shares}")
        except api.ApiError as e:
            log.append(f"FAILED {side} {ticker} {shares}: {e}")
    return log
