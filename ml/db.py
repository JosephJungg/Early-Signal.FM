"""Postgres access for the ML job. Reads the same env vars as the Spring Boot API."""
import os
from datetime import date

import psycopg


def connect() -> psycopg.Connection:
    # The API uses a JDBC URL (jdbc:postgresql://host:port/db); psycopg wants postgresql://...
    url = os.environ.get("DATABASE_URL", "jdbc:postgresql://localhost:5432/earlysignal")
    url = url.removeprefix("jdbc:")
    # autocommit: each read sees the latest Advance Day; writes use conn.transaction()
    if "@" in url:
        # Render-style postgresql://user:pass@host/db already carries credentials; passing user= would override them.
        return psycopg.connect(url, autocommit=True)
    return psycopg.connect(
        url,
        user=os.environ.get("DATABASE_USER", "earlysignal"),
        password=os.environ.get("DATABASE_PASSWORD", "earlysignal"),
        autocommit=True,
    )


def game_date(conn) -> date | None:
    """None until the API has seeded the game."""
    row = conn.execute("SELECT game_date FROM game_state WHERE id = 1").fetchone()
    return row[0] if row else None


def artists(conn) -> list[dict]:
    rows = conn.execute("SELECT id, ticker, tier FROM artists ORDER BY id").fetchall()
    return [{"id": r[0], "ticker": r[1], "tier": r[2]} for r in rows]


def history(conn, artist_id: int, days: int = 60) -> tuple[list[date], list[float], list[int]]:
    """Last `days` daily (dates, prices, listeners), oldest first."""
    rows = conn.execute(
        """SELECT game_date, price, listeners FROM (
               SELECT game_date, price, listeners FROM price_history
               WHERE artist_id = %s ORDER BY game_date DESC LIMIT %s
           ) t ORDER BY game_date""",
        (artist_id, days),
    ).fetchall()
    return [r[0] for r in rows], [float(r[1]) for r in rows], [int(r[2]) for r in rows]


def has_current_forecasts(conn) -> bool:
    """False after /api/admin/reset (which truncates forecasts) or before the first run."""
    return conn.execute(
        "SELECT EXISTS (SELECT 1 FROM forecasts WHERE forecast_date > (SELECT game_date FROM game_state WHERE id = 1))"
    ).fetchone()[0]


def replace_forecasts(conn, artist_id: int, rows: list[tuple[date, float, float, float]]) -> None:
    """Drop this artist's old forecast rows (including days already played) and write the new ones."""
    with conn.transaction():
        conn.execute("DELETE FROM forecasts WHERE artist_id = %s", (artist_id,))
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO forecasts (artist_id, forecast_date, mean, lower, upper) VALUES (%s, %s, %s, %s, %s)",
                [(artist_id, d, round(m, 2), round(lo, 2), round(hi, 2)) for d, m, lo, hi in rows],
            )
