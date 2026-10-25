"""The non-human players. Each bot looks at a View of the market once per game day and returns
orders; it never touches the database. live.py runs them through the real API, sim.py runs them
in an offline copy of the game for the tournament.
"""
import math
import random
from dataclasses import dataclass

FEE = 0.01
CAP = 0.29  # backend rejects buys past 30% of portfolio; stay a little under for rounding


@dataclass
class View:
    """Everything a bot may look at on one game day."""
    date: str
    prices: dict[str, float]           # ticker -> current price
    tiers: dict[str, str]              # ticker -> BLUE_CHIP / MID / UNDERGROUND
    history: dict[str, list[float]]    # ticker -> daily prices, oldest first, ending today
    forecasts: dict[str, dict]         # ticker -> {"mean": [...7], "lower": [...], "upper": [...]}
    cash: float
    holdings: dict[str, int]           # ticker -> shares

    @property
    def total(self) -> float:
        return self.cash + sum(n * self.prices[t] for t, n in self.holdings.items())


Order = tuple[str, str, int]  # (side, ticker, shares)


def signal_score(price: float, fc: dict) -> float:
    """Expected 7-day gain divided by uncertainty, the same score the terminal shows.
    Above 0.2 the terminal says BUY, below -0.2 SELL."""
    mean, lower, upper = fc["mean"][-1], fc["lower"][-1], fc["upper"][-1]
    uncertainty = (upper - lower) / 2 / price
    return (mean / price - 1) / uncertainty if uncertainty > 0 else 0.0


def rebalance(view: View, targets: dict[str, float], min_trade: float = 0.03, trim: bool = True) -> list[Order]:
    """Orders that move the portfolio toward target weights (fractions of total value).

    Sells come first so their cash funds the buys. Moves smaller than min_trade of the
    portfolio are skipped, since every trade pays the 1% fee. trim=False never sells part of a
    position that grew past its target; it only sells what drops out of `targets`.
    """
    total, cash = view.total, view.cash
    sells, buys = [], []
    for t, shares in view.holdings.items():
        price = view.prices[t]
        excess = shares * price - targets.get(t, 0.0) * total
        if t not in targets:
            n = shares
        elif trim and excess > min_trade * total:
            n = int(excess // price)
        else:
            continue
        if n > 0:
            sells.append(("SELL", t, n))
            cash += n * price * (1 - FEE)
    for t, w in sorted(targets.items(), key=lambda kv: -kv[1]):
        price = view.prices[t]
        gap = min(w, CAP) * total - view.holdings.get(t, 0) * price
        if gap <= min_trade * total:
            continue
        n = int(min(gap, cash / (1 + FEE)) // price)
        if n > 0:
            buys.append(("BUY", t, n))
            cash -= n * price * (1 + FEE)
    return sells + buys


def capped_weights(scores: dict[str, float], invest: float = 0.97, cap: float = CAP) -> dict[str, float]:
    """Split `invest` across tickers in proportion to score, with no ticker above `cap`."""
    weights, left, open_ = {}, invest, dict(scores)
    while open_ and left > 1e-9:
        total = sum(open_.values())
        share = {t: left * s / total for t, s in open_.items()}
        over = {t for t, w in share.items() if w > cap}
        if not over:
            weights.update(share)
            break
        for t in over:
            weights[t] = cap
            left -= cap
            del open_[t]
    return weights


class Bot:
    name = "BOT"
    kind = "bot"  # leaderboard label: human, bot or ai

    def decide(self, view: View) -> list[Order]:
        raise NotImplementedError


class AIBot(Bot):
    """Trades on the GP forecasts.

    Ranks artists by the slope of their forecast cone, i.e. the growth rate the model estimated
    from listener data, and holds the best `top` in equal amounts, skipping anything the terminal
    rates SELL. The slope ignores where the cone starts, which moves with day-to-day noise.
    It keeps a holding unless a replacement grows faster by more than `switch_margin` per day,
    and never trims winners, so it doesn't bleed 1% fees on small reshuffles.
    """
    name = "ES-GPR"
    kind = "ai"

    def __init__(self, top: int = 4, switch_margin: float = 0.004):
        self.top, self.switch_margin = top, switch_margin

    def decide(self, view):
        growth = {}
        for t, fc in view.forecasts.items():
            if signal_score(view.prices[t], fc) <= 0:
                continue
            slope = math.log(fc["mean"][-1] / fc["mean"][0]) / (len(fc["mean"]) - 1)
            growth[t] = slope + (self.switch_margin if t in view.holdings else 0.0)
        picks = sorted(growth, key=growth.get, reverse=True)[:self.top]
        return rebalance(view, capped_weights({t: 1.0 for t in picks}), min_trade=0.08, trim=False)


class IndexBot(Bot):
    """Buys every artist in equal amounts on its first day and never trades again. The benchmark."""
    name = "HODL-BOT"

    def decide(self, view):
        if view.holdings:
            return []
        w = 0.98 / len(view.prices)
        return rebalance(view, {t: w for t in view.prices}, min_trade=0.0)


class MomentumBot(Bot):
    """Holds the 3 artists that rose most over the last `lookback` days. Chases hype."""
    name = "MOMENTUM-BOT"

    def __init__(self, lookback: int = 5, top: int = 3):
        self.lookback, self.top = lookback, top

    def decide(self, view):
        rets = {t: h[-1] / h[-1 - self.lookback] - 1 for t, h in view.history.items() if len(h) > self.lookback}
        winners = [t for t, r in sorted(rets.items(), key=lambda kv: -kv[1])[:self.top] if r > 0]
        return rebalance(view, {t: CAP for t in winners}, min_trade=0.05)


class RandomBot(Bot):
    """Makes a random trade most days. The monkey-with-darts baseline."""
    name = "RANDOM-BOT"

    def decide(self, view):
        rng = random.Random(f"{self.name}:{view.date}")  # repeatable for a given day
        roll = rng.random()
        if roll < 0.5:
            t = rng.choice(sorted(view.prices))
            n = int(min(0.10 * view.total, view.cash / (1 + FEE)) // view.prices[t])
            held_value = (view.holdings.get(t, 0) + n) * view.prices[t]
            if n > 0 and held_value <= CAP * view.total:
                return [("BUY", t, n)]
        elif roll < 0.8 and view.holdings:
            t = rng.choice(sorted(view.holdings))
            return [("SELL", t, view.holdings[t])]
        return []


def all_bots() -> list[Bot]:
    return [AIBot(), IndexBot(), MomentumBot(), RandomBot()]
