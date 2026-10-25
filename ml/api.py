"""Thin client for the Earlysignal API. Bots trade through this, exactly like a human player."""
import os

import requests

BASE_URL = os.environ.get("API_URL", "http://localhost:8080").rstrip("/")


class ApiError(Exception):
    pass


def _call(method: str, path: str, **kwargs):
    r = requests.request(method, f"{BASE_URL}/api{path}", timeout=10, **kwargs)
    if r.status_code >= 400:
        try:
            msg = r.json().get("error", r.text)
        except ValueError:
            msg = r.text
        raise ApiError(f"{method} {path} -> {r.status_code}: {msg}")
    return r.json()


def create_user(username: str, kind: str = "bot") -> dict:
    """Creates the player or returns the existing one. kind: human, bot or ai (the leaderboard
    highlights ai)."""
    return _call("POST", "/users", json={"username": username, "kind": kind})


def game_date() -> str:
    return _call("GET", "/game")["gameDate"]


def market() -> dict:
    """Everything in one call: {gameDate, day, artists: [{id, ticker, tier, price, history, forecast, ...}]}."""
    return _call("GET", "/market")


def artists() -> list[dict]:
    return _call("GET", "/artists")


def history(artist_id: int) -> list[dict]:
    return _call("GET", f"/artists/{artist_id}/history")


def forecast(artist_id: int) -> list[dict]:
    return _call("GET", f"/artists/{artist_id}/forecast")


def events(limit: int = 50) -> list[dict]:
    return _call("GET", "/events", params={"limit": limit})


def portfolio(user_id: int) -> dict:
    return _call("GET", f"/portfolio/{user_id}")


def trade(user_id: int, ticker: str, side: str, shares: int) -> dict:
    return _call("POST", "/trades", json={"userId": user_id, "ticker": ticker, "side": side, "shares": shares})


def leaderboard(limit: int = 50) -> list[dict]:
    return _call("GET", "/leaderboard", params={"limit": limit})
