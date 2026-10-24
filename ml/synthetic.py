"""Price series that follow the same rules as the backend's PriceEngine.

Lets us test the GP and bots without a running backend, and is the hour-3 fallback if we
ever need history the backend didn't generate.
"""
import numpy as np

# Matches DataSeeder: (daily volatility, daily listener drift) per tier.
TIERS = {"BLUE_CHIP": (0.012, 0.001), "MID": (0.025, 0.003), "UNDERGROUND": (0.05, 0.006)}
P_VIRAL = {"UNDERGROUND": 0.04, "MID": 0.02, "BLUE_CHIP": 0.005}
MAX_DAILY_MOVE = 0.25


def simulate(tier: str = "UNDERGROUND", days: int = 60, start_price: float = 18.40, seed: int | None = None,
             with_boosts: bool = False):
    """Daily prices, oldest first. with_boosts also returns artists.release_boost as it stood
    at the end of each day (what the forecast job would read from the database)."""
    rng = np.random.default_rng(seed)
    vol, drift = TIERS[tier]
    p_viral, p_drop, p_release = P_VIRAL[tier], (0.03 if tier == "UNDERGROUND" else 0.015), 0.03
    prices, boost, boosts = [start_price], 0.0, [0.0]
    for _ in range(days - 1):
        growth = drift + 0.5 * vol * rng.standard_normal()
        roll = rng.random()
        if roll < p_viral:
            growth += 0.15 + 0.25 * rng.random()
        elif roll < p_viral + p_drop:
            growth -= 0.08 + 0.12 * rng.random()
        elif roll < p_viral + p_drop + p_release:
            boost = 0.06
        ret = np.clip(0.8 * growth + boost + vol * rng.standard_normal(), -MAX_DAILY_MOVE, MAX_DAILY_MOVE)
        prices.append(max(0.5, round(prices[-1] * np.exp(ret), 2)))
        boost = boost * 0.5 if boost * 0.5 >= 0.005 else 0.0
        boosts.append(boost)
    return (prices, boosts) if with_boosts else prices

