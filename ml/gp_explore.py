"""Checks the forecasting choices by backtesting: pretend it's an earlier day, forecast 7 days,
compare with what happened.

    python gp_explore.py --synthetic           # engine-style simulated markets, no backend needed
    python gp_explore.py --ticker LUNA         # real history from Postgres
    python gp_explore.py --ticker LUNA --plot  # also save forecast_LUNA.png

Two questions:
  1. Which GP kernel? A good one beats "price stays flat" and its 90% band holds the real price
     about 90% of the time.
  2. Which drift? Flat, one market-wide average, each artist's own price average (raw or shrunk
     toward the market), or growth estimated from listeners (what forecast_job uses).
"""
import argparse

import numpy as np

import gp
import synthetic
from forecast_job import KERNEL, price_drifts

HORIZON = 7


def rmse(errors) -> float:
    return float(np.sqrt(np.mean(np.square(errors))))


def backtest_kernels(series_list, min_train: int = 20, step: int = 5):
    rows = {}
    for kernel in gp.KERNELS:
        errs, flat, inside, widths = [], [], [], []
        for prices in series_list:
            prices = np.asarray(prices, dtype=float)
            for cut in range(min_train, len(prices) - HORIZON + 1, step):
                mean, lower, upper = gp.forecast(prices[:cut], HORIZON, kernel)
                actual = prices[cut:cut + HORIZON]
                errs.append(np.log(mean[-1] / actual[-1]))
                flat.append(np.log(prices[cut - 1] / actual[-1]))
                inside.extend((actual >= lower) & (actual <= upper))
                widths.append((upper[-1] - lower[-1]) / mean[-1])
        rows[kernel] = {"rmse": rmse(errs), "flat": rmse(flat), "coverage": float(np.mean(inside)),
                        "width": float(np.mean(widths))}
    return rows


def backtest_drift(markets, kernel: str, cuts=(30, 37, 44, 51)):
    """markets: list of {ticker: (prices, listeners)}. Drift is estimated from every artist's
    history up to the cutoff, exactly as the job would on that day."""
    errs = {m: [] for m in ("flat", "market", "own", "shrunk", "listeners")}
    inside = []
    for market in markets:
        for cut in cuts:
            hist = {t: np.asarray(p[:cut], dtype=float) for t, (p, _) in market.items()}
            rets = {t: np.diff(np.log(h)) for t, h in hist.items()}
            market_mean = float(np.mean(np.concatenate(list(rets.values()))))
            shrunk = gp.artist_drifts(rets)
            listeners = price_drifts([{"key": t, "prices": p[:cut], "listeners": n[:cut]} for t, (p, n) in market.items()])
            for t, h in hist.items():
                future = np.asarray(market[t][0][cut:cut + HORIZON])
                drifts = {"flat": (0.0, 0.0), "market": (market_mean, 0.0), "own": (float(rets[t].mean()), 0.0),
                          "shrunk": shrunk[t], "listeners": listeners[t]}
                for m, (d, se) in drifts.items():
                    mean, lower, upper = gp.forecast(h, HORIZON, kernel, drift=d, drift_se=se)
                    errs[m].append(np.log(mean[-1] / future[-1]))
                    if m == "listeners":
                        inside.extend((future >= lower) & (future <= upper))
    return {m: (float(np.mean(e)), rmse(e)) for m, e in errs.items()}, float(np.mean(inside)), len(errs["flat"])


def load_db(days: int):
    import db
    with db.connect() as conn:
        hist = {}
        for a in db.artists(conn):
            _, prices, listeners = db.history(conn, a["id"], days)
            hist[a["ticker"]] = (prices, listeners)
        return hist, db.game_date(conn)


def main():
    ap = argparse.ArgumentParser()
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--ticker", help="artist ticker to load from Postgres, e.g. LUNA")
    src.add_argument("--synthetic", action="store_true", help="simulate markets instead")
    ap.add_argument("--markets", type=int, default=6, help="simulated markets for --synthetic")
    ap.add_argument("--plot", action="store_true", help="save a PNG of the forecast cone")
    args = ap.parse_args()

    if args.synthetic:
        markets = [synthetic.simulate_market(60, seed=s) for s in range(args.markets)]
        hist, label = markets[0], "LUNA"
        kernel_series = [m[t][0] for m in markets[:2] for t in m]
        print(f"{args.markets} simulated markets x 24 artists x 60 days")
    else:
        hist, today = load_db(60)
        label = args.ticker.upper()
        if label not in hist:
            raise SystemExit(f"No artist with ticker {label}")
        kernel_series = [hist[label][0]]
        print(f"{label}: {len(hist[label][0])} days of history up to game date {today}")

    print(f"\n1. Kernels ({HORIZON}-day horizon). Lower error is better; coverage should be near 90%.")
    print(f"{'kernel':<8}{'log RMSE':>10}{'flat RMSE':>11}{'coverage':>10}{'band width':>12}")
    kernels = backtest_kernels(kernel_series)
    for k, r in kernels.items():
        print(f"{k:<8}{r['rmse']:>10.3f}{r['flat']:>11.3f}{r['coverage']:>10.0%}{r['width']:>12.0%}")
    honest = [k for k in gp.KERNELS if 0.75 <= kernels[k]["coverage"] <= 0.97] or list(gp.KERNELS)
    best = min(honest, key=lambda k: kernels[k]["rmse"])
    print(f"Best here: {best}. The job uses KERNEL={KERNEL} (set the KERNEL env var to change it);"
          " the rest of this report uses that.")
    best = KERNEL

    if args.synthetic:
        print(f"\n2. Drift ({HORIZON}-day horizon). Bias < 0 means forecasts were too low.")
        res, coverage, n = backtest_drift(markets, best)
        names = {"flat": "no drift", "market": "market average", "own": "own price average",
                 "shrunk": "own price, shrunk", "listeners": "listener growth (job)"}
        print(f"{'':<24}{'bias':>8}{'log RMSE':>10}")
        for m, (bias, err) in res.items():
            print(f"{names[m]:<24}{bias:>8.3f}{err:>10.3f}")
        print(f"({n} forecasts; the job's 90% band held the real price {coverage:.0%} of the time)")

    drifts = price_drifts([{"key": t, "prices": p, "listeners": n} for t, (p, n) in hist.items()])
    drift, se = drifts[label]
    prices = hist[label][0]
    mean, lower, upper = gp.forecast(prices, HORIZON, best, drift=drift, drift_se=se)
    print(f"\n{label} forecast from {prices[-1]:.2f} (drift {drift * 100:+.2f}%/day)")
    print(f"{'day':>4}{'lower':>9}{'mean':>9}{'upper':>9}{'chg':>8}")
    for i in range(HORIZON):
        print(f"{'+' + str(i + 1):>4}{lower[i]:>9.2f}{mean[i]:>9.2f}{upper[i]:>9.2f}{mean[i] / prices[-1] - 1:>8.1%}")

    if args.plot:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        x_fc = np.arange(len(prices), len(prices) + HORIZON)
        fig, ax = plt.subplots(figsize=(9, 4))
        ax.plot(np.arange(len(prices)), prices, color="black", lw=1.2, label="price")
        ax.fill_between(x_fc, lower, upper, alpha=0.25, label="90% band")
        ax.plot(x_fc, mean, ls="--", label=f"GP mean ({best})")
        ax.set_title(f"{label}: 7-day GP forecast")
        ax.set_xlabel("day")
        ax.legend()
        out = f"forecast_{label}.png"
        fig.savefig(out, dpi=120, bbox_inches="tight")
        print(f"\nSaved {out}")


if __name__ == "__main__":
    main()
