"""Fit the GP for one artist and pick a kernel by backtesting.

    python gp_explore.py --ticker LUNA            # real history from Postgres
    python gp_explore.py --synthetic UNDERGROUND  # engine-style fake series, no backend needed
    python gp_explore.py --ticker LUNA --plot     # also save forecast_<TICKER>.png

Backtest: at several cutoff days, fit on everything before the cutoff, forecast 7 days, and
compare to what happened. A good kernel beats the "price stays flat" baseline on error and its
90% band contains the real price about 90% of the time.
"""
import argparse

import numpy as np

import gp
import synthetic

HORIZON = 7


def backtest(series_list, kernel: str, min_train: int = 20, step: int = 3):
    errs, naive_errs, inside, widths = [], [], [], []
    for prices in series_list:
        prices = np.asarray(prices, dtype=float)
        for cut in range(min_train, len(prices) - HORIZON + 1, step):
            mean, lower, upper = gp.forecast(prices[:cut], HORIZON, kernel)
            actual = prices[cut:cut + HORIZON]
            errs.append(np.log(mean[-1] / actual[-1]))
            naive_errs.append(np.log(prices[cut - 1] / actual[-1]))
            inside.extend((actual >= lower) & (actual <= upper))
            widths.append((upper[-1] - lower[-1]) / mean[-1])
    rmse = lambda e: float(np.sqrt(np.mean(np.square(e))))
    return {"rmse": rmse(errs), "naive": rmse(naive_errs), "coverage": float(np.mean(inside)),
            "width": float(np.mean(widths)), "n": len(errs)}


def backtest_drift(tier: str, kernel: str, n_series: int = 40, days: int = 60, min_train: int = 30, step: int = 5):
    """Plain GP vs GP + tier drift + release boost, 7 days ahead.

    Tier drift is estimated the way the job does it: pooled over other artists in the same tier
    (here, 7 independent simulated series of the same length as the training window).
    Also reports the release-day subset, where the boost adjustment matters.
    """
    rows = {"plain": [], "full": [], "plain_rel": [], "full_rel": []}
    for s in range(n_series):
        prices, boosts = synthetic.simulate(tier, days, seed=1000 + s, with_boosts=True)
        prices = np.asarray(prices)
        peers = [synthetic.simulate(tier, days, seed=50_000 + 10 * s + j, with_boosts=True) for j in range(7)]
        for cut in range(min_train, days - HORIZON + 1, step):
            drift, drift_se = gp.tier_drift(np.diff(np.log(p[:cut])) for p, _ in peers)
            boost = boosts[cut - 1]
            actual = prices[cut + HORIZON - 1]
            plain = gp.forecast(prices[:cut], HORIZON, kernel)[0][-1]
            full = gp.forecast(prices[:cut], HORIZON, kernel, drift=drift, drift_se=drift_se, boost=boost)[0][-1]
            rows["plain"].append(np.log(plain / actual))
            rows["full"].append(np.log(full / actual))
            if boost > 0:
                rows["plain_rel"].append(rows["plain"][-1])
                rows["full_rel"].append(rows["full"][-1])
    return {k: (float(np.mean(v)), float(np.sqrt(np.mean(np.square(v)))), len(v)) for k, v in rows.items()}


def load_history(ticker: str, days: int):
    import db
    with db.connect() as conn:
        match = [a for a in db.artists(conn) if a["ticker"] == ticker.upper()]
        if not match:
            raise SystemExit(f"No artist with ticker {ticker}")
        dates, prices = db.price_history(conn, match[0]["id"], days)
        return dates, prices, db.game_date(conn)


def main():
    ap = argparse.ArgumentParser()
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--ticker", help="artist ticker to load from Postgres, e.g. LUNA")
    src.add_argument("--synthetic", choices=synthetic.TIERS, help="simulate series for this tier instead")
    ap.add_argument("--days", type=int, default=60, help="history window to fit on")
    ap.add_argument("--plot", action="store_true", help="save a PNG of the forecast cone")
    args = ap.parse_args()

    if args.ticker:
        dates, prices, today = load_history(args.ticker, args.days)
        label, series_list = args.ticker.upper(), [prices]
        print(f"{label}: {len(prices)} days of history up to game date {today}")
    else:
        series_list = [synthetic.simulate(args.synthetic, args.days, seed=s) for s in range(5)]
        prices, dates, label = series_list[0], None, f"synthetic {args.synthetic}"
        print(f"{label}: 5 simulated series x {args.days} days")

    print(f"\nBacktest ({HORIZON}-day horizon). Lower error is better; coverage should be near 90%.")
    print(f"{'kernel':<8}{'log RMSE':>10}{'flat RMSE':>11}{'coverage':>10}{'band width':>12}")
    results = {}
    for k in gp.KERNELS:
        r = results[k] = backtest(series_list, k)
        print(f"{k:<8}{r['rmse']:>10.3f}{r['naive']:>11.3f}{r['coverage']:>10.0%}{r['width']:>12.0%}")
    # Prefer accurate kernels whose bands are honest (coverage within 80-97%).
    honest = [k for k in gp.KERNELS if 0.80 <= results[k]["coverage"] <= 0.97] or list(gp.KERNELS)
    best = min(honest, key=lambda k: results[k]["rmse"])
    print(f"\nPicked kernel: {best}")

    if args.synthetic:
        print(f"\nTier drift + release boost ({HORIZON}-day horizon). Bias < 0 means forecasts were too low.")
        r = backtest_drift(args.synthetic, best)
        print(f"{'':<22}{'bias':>8}{'log RMSE':>10}{'n':>6}")
        for key, name in [("plain", "plain GP"), ("full", "GP + drift + boost"),
                          ("plain_rel", "plain, after release"), ("full_rel", "full, after release")]:
            print(f"{name:<22}{r[key][0]:>8.3f}{r[key][1]:>10.3f}{r[key][2]:>6}")

    mean, lower, upper = gp.forecast(prices, HORIZON, best)
    print(f"\n{label} forecast from last price {prices[-1]:.2f}")
    print(f"{'day':>4}{'lower':>9}{'mean':>9}{'upper':>9}{'chg':>8}")
    for i in range(HORIZON):
        print(f"{'+' + str(i + 1):>4}{lower[i]:>9.2f}{mean[i]:>9.2f}{upper[i]:>9.2f}{mean[i] / prices[-1] - 1:>8.1%}")

    if args.plot:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        x_hist = np.arange(len(prices))
        x_fc = np.arange(len(prices), len(prices) + HORIZON)
        fig, ax = plt.subplots(figsize=(9, 4))
        ax.plot(x_hist, prices, color="black", lw=1.2, label="price")
        ax.fill_between(x_fc, lower, upper, alpha=0.25, label="90% band")
        ax.plot(x_fc, mean, ls="--", label=f"GP mean ({best})")
        ax.set_title(f"{label}: 7-day GP forecast")
        ax.set_xlabel("day")
        ax.legend()
        out = f"forecast_{label.replace(' ', '_')}.png"
        fig.savefig(out, dpi=120, bbox_inches="tight")
        print(f"\nSaved {out}")


if __name__ == "__main__":
    main()
