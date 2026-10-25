"""An offline copy of the game: the same 24 artists, price rules, fee and position cap as the
backend, plus the same forecasts. Lets the bots play hundreds of seasons in seconds.
"""
import numpy as np

import synthetic
from bots import FEE, View
from forecast_job import forecast_all

STARTING_CASH = 10_000.0
MAX_POSITION = 0.30


class SimTradeError(Exception):
    pass


class SimMarket:
    def __init__(self, seed: int, history_days: int = 30):
        self.rng = np.random.default_rng(seed)
        self.day = 0
        self.params = {t: (drift, vol) for t, _, _, drift, vol in synthetic.SEEDS}
        self.tiers = dict(synthetic.TIERS)
        self.history = {t: [p] for t, p, _, _, _ in synthetic.SEEDS}
        self.listeners = {t: [n] for t, _, n, _, _ in synthetic.SEEDS}
        self.users: dict[str, dict] = {}
        self.forecasts: dict[str, dict] = {}
        for _ in range(history_days):  # backstory, like DataSeeder
            self.advance()
        self.day = 0

    def price(self, t: str) -> float:
        return self.history[t][-1]

    def advance(self) -> None:
        for t, (drift, vol) in self.params.items():
            price, listeners, _ = synthetic.step(self.price(t), self.listeners[t][-1], drift, vol, self.rng)
            self.history[t].append(price)
            self.listeners[t].append(listeners)
        self.day += 1

    def refresh_forecasts(self) -> None:
        fc, _ = forecast_all([{"key": t, "prices": h[-60:], "listeners": self.listeners[t][-60:]}
                              for t, h in self.history.items()])
        self.forecasts = {t: {"mean": list(m), "lower": list(lo), "upper": list(hi)} for t, (m, lo, hi) in fc.items()}

    def add_user(self, name: str) -> None:
        self.users[name] = {"cash": STARTING_CASH, "holdings": {}}

    def total(self, name: str) -> float:
        u = self.users[name]
        return u["cash"] + sum(n * self.price(t) for t, n in u["holdings"].items())

    def view(self, name: str) -> View:
        u = self.users[name]
        return View(date=str(self.day), prices={t: self.price(t) for t in self.history}, tiers=dict(self.tiers),
                    history={t: list(h) for t, h in self.history.items()}, forecasts=self.forecasts,
                    cash=u["cash"], holdings=dict(u["holdings"]))

    def trade(self, name: str, side: str, ticker: str, shares: int) -> None:
        """Same checks as the backend's TradeService."""
        u = self.users[name]
        price = self.price(ticker)
        notional = round(price * shares, 2)
        fee = round(notional * FEE, 2)
        held = u["holdings"].get(ticker, 0)
        if side == "BUY":
            if u["cash"] < notional + fee:
                raise SimTradeError("insufficient credits")
            cash_after = u["cash"] - notional - fee
            holdings_value = sum(n * self.price(t) for t, n in u["holdings"].items())
            if price * (held + shares) > MAX_POSITION * (cash_after + holdings_value + notional):
                raise SimTradeError("position limit")
            u["cash"] = cash_after
            u["holdings"][ticker] = held + shares
        else:
            if held < shares:
                raise SimTradeError("not enough shares")
            u["cash"] += notional - fee
            if held == shares:
                del u["holdings"][ticker]
            else:
                u["holdings"][ticker] = held - shares
