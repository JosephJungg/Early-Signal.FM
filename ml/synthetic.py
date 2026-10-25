"""Price series that follow the same rules as the backend's PriceEngine and DataSeeder.

Lets us test the GP and bots without a running backend, and is the fallback if we ever need
history the backend didn't generate. Keep in sync with backend/.../engine/.
"""
import numpy as np

MAX_DAILY_MOVE = 0.45
EVENT_CHANCE = 0.07
LISTENER_WEIGHT = 0.8

# PriceEngine.EVENT_KINDS: (type, min impact, max impact) on that day's log-return only.
EVENT_KINDS = [
    ("VIRAL SPIKE", 0.15, 0.40), ("PLAYLIST ADD", 0.05, 0.12), ("TOUR ANNOUNCED", 0.03, 0.08),
    ("LABEL SIGNING", 0.06, 0.15), ("COLLAB DROP", 0.04, 0.10), ("ALBUM DELAY", -0.10, -0.04),
    ("COLD STREAK", -0.25, -0.10),
]

# DataSeeder.SEEDS: (ticker, starting price, listeners, daily listener drift, daily volatility).
SEEDS = [
    ("NETT", 18.4, 1_840_000, 0.01, 0.045),
    ("YEAT", 42.1, 6_200_000, 0.004, 0.03),
    ("MKG", 27.6, 3_100_000, 0.006, 0.035),
    ("WISP", 12.9, 920_000, 0.003, 0.05),
    ("CLR", 35.2, 4_700_000, 0.008, 0.032),
    ("FMNK", 6.4, 310_000, 0.0, 0.07),
    ("JANE", 9.8, 640_000, 0.007, 0.055),
    ("SNOW", 22.3, 2_250_000, 0.005, 0.04),
    ("LAUF", 51.7, 9_800_000, 0.003, 0.022),
    ("WYAT", 30.5, 3_600_000, 0.002, 0.025),
    ("OSA", 4.2, 180_000, 0.012, 0.085),
    ("LNKR", 14.6, 1_120_000, 0.001, 0.03),
    ("KNKL", 11.3, 780_000, -0.001, 0.038),
    ("KEN", 46.8, 8_100_000, 0.004, 0.028),
    ("ODTR", 19.9, 2_000_000, -0.002, 0.042),
    ("BLDE", 7.1, 520_000, 0.006, 0.048),
    ("WALL", 16.2, 1_380_000, 0.001, 0.036),
    ("HOVV", 10.4, 700_000, 0.004, 0.04),
    ("HOLS", 5.6, 260_000, 0.011, 0.075),
    ("DISC", 24.8, 2_600_000, 0.003, 0.033),
    ("FAYE", 21.5, 2_050_000, 0.005, 0.031),
    ("GLVE", 8.9, 590_000, 0.002, 0.044),
    ("DSTRY", 13.7, 1_450_000, 0.006, 0.058),
    ("CHAP", 61.3, 12_400_000, 0.002, 0.02),
    ("BEA", 48.5, 7_400_000, 0.003, 0.024),
    ("DOM", 39.9, 5_600_000, 0.003, 0.027),
    ("MRIA", 26.4, 3_400_000, 0.007, 0.036),
    ("ETHL", 23.1, 2_800_000, 0.007, 0.04),
    ("MTOD", 6.8, 430_000, 0.011, 0.065),
    ("JVB", 8.2, 610_000, 0.008, 0.06),
    ("QUAD", 9.6, 820_000, 0.005, 0.045),
    ("ECCO", 7.4, 560_000, 0.004, 0.058),
    ("LUCY", 3.9, 150_000, 0.012, 0.09),
    ("FENG", 4.6, 210_000, 0.011, 0.085),
    ("MAC", 28.7, 3_900_000, -0.001, 0.03),
]


def tier_of(listeners: int) -> str:
    """Same thresholds as DataSeeder."""
    return "BLUE_CHIP" if listeners >= 5_000_000 else "MID" if listeners >= 1_000_000 else "UNDERGROUND"


TIERS = {t: tier_of(listeners) for t, _, listeners, _, _ in SEEDS}


def step(price: float, listeners: int, drift: float, vol: float, rng) -> tuple[float, int, str | None]:
    """One game day for one artist. Returns (new price, new listeners, event type or None).

    Listeners grow at the artist's drift with half the noise that prices get, which is why the
    forecast estimates growth from listeners rather than prices.
    """
    growth = drift + 0.5 * vol * rng.standard_normal()
    ret = LISTENER_WEIGHT * growth + vol * rng.standard_normal()
    event = None
    if rng.random() < EVENT_CHANCE:
        event, lo, hi = EVENT_KINDS[rng.integers(len(EVENT_KINDS))]
        impact = lo + rng.random() * (hi - lo)
        ret += impact
        growth += 0.6 * impact
    ret = min(MAX_DAILY_MOVE, max(-MAX_DAILY_MOVE, ret))
    new_listeners = max(1000, round(listeners * (1 + growth)))
    return max(0.5, round(price * float(np.exp(ret)), 2)), new_listeners, event


def simulate_market(days: int = 60, seed: int | None = None) -> dict[str, tuple[list[float], list[int]]]:
    """All artists for `days` days (day 0 is the seed). ticker -> (prices, listeners), oldest first."""
    rng = np.random.default_rng(seed)
    out = {}
    for ticker, price, listeners, drift, vol in SEEDS:
        prices, counts = [price], [listeners]
        for _ in range(days - 1):
            p, n, _ = step(prices[-1], counts[-1], drift, vol, rng)
            prices.append(p)
            counts.append(n)
        out[ticker] = (prices, counts)
    return out
