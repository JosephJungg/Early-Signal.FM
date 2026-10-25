"""Gaussian process price forecasts.

We model log-price against day index, around a per-artist drift (see artist_drifts). Daily moves
in the price engine are a noisy random walk with drift plus one-day event jumps, so the candidate
kernels are:
  ou      Matern(nu=0.5) + noise   — the GP form of a random walk; the long length scale stops it
          pulling the forecast back toward the old average
  rbf     RBF + noise              — smooth trend, reverts to the mean outside the data
  trend   linear + Matern(nu=0.5) + noise — random walk on top of a straight-line drift
gp_explore.py backtests them; pick one and pass it as KERNEL to the forecast job.
"""
import warnings

import numpy as np
from sklearn.exceptions import ConvergenceWarning
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, ConstantKernel, DotProduct, Matern, WhiteKernel

Z90 = 1.645  # two-sided 90% interval, matching the frontend's cone
# Viral spikes and listener drops are jumps a Gaussian can't see, so raw GP bands only cover
# ~77% of outcomes in backtests. Widening by this factor gets ~83-86%; covering the jumps fully
# would make the cone uselessly wide.
BAND_SCALE = 1.35


def make_kernel(name: str):
    noise = WhiteKernel(noise_level=1e-3, noise_level_bounds=(1e-6, 1e-1))
    amp = ConstantKernel(0.05, (1e-4, 10.0))
    if name == "ou":
        return amp * Matern(length_scale=50.0, length_scale_bounds=(30.0, 2000.0), nu=0.5) + noise
    if name == "rbf":
        return amp * RBF(length_scale=10.0, length_scale_bounds=(1.0, 200.0)) + noise
    if name == "trend":
        linear = ConstantKernel(1e-3, (1e-6, 1.0)) * DotProduct(sigma_0=1.0, sigma_0_bounds="fixed")
        return linear + amp * Matern(length_scale=50.0, length_scale_bounds=(30.0, 2000.0), nu=0.5) + noise
    raise ValueError(f"Unknown kernel {name!r}; use ou, rbf or trend")


KERNELS = ("ou", "rbf", "trend")


def forecast(prices, horizon: int = 7, kernel: str = "ou", drift: float = 0.0, drift_se: float = 0.0):
    """Fit on a price series (oldest first) and forecast the next `horizon` days.

    drift: expected daily log-return for this artist (see artist_drifts). The GP models how the
           price wanders around that trend, so the forecast keeps rising (or falling) with it.
    drift_se: standard error of that estimate; widens the band further out, where a wrong
           drift compounds.

    Returns (mean, lower, upper) arrays of prices, each of length `horizon`.
    Bounds are 90% intervals and include day-to-day noise, so they say where the price will
    actually land, not just where the trend is.
    """
    y = np.log(np.asarray(prices, dtype=float))
    n = len(y)
    days = np.arange(n + horizon, dtype=float)
    # Scale time so DotProduct's trend term stays well conditioned.
    t = days.reshape(-1, 1) / 10.0

    gp = GaussianProcessRegressor(kernel=make_kernel(kernel), normalize_y=True, n_restarts_optimizer=2,
                                  random_state=0)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ConvergenceWarning)
        gp.fit(t[:n], y - drift * days[:n])
    mu, sd = gp.predict(t[n:], return_std=True)
    mu = mu + drift * days[n:]
    sd = np.sqrt(sd**2 + (drift_se * np.arange(1, horizon + 1)) ** 2)
    band = Z90 * BAND_SCALE * sd
    return np.exp(mu), np.exp(mu - band), np.exp(mu + band)


def artist_drifts(returns: dict, trim: float = 0.0) -> dict:
    """Each artist's expected daily growth, shrunk toward the market average.

    returns: key -> array of that artist's daily log-changes (prices or listeners).
    trim: fraction cut from each end before averaging. One-day event jumps hit every artist alike
          on average, so trimming them removes noise without biasing the comparison between artists.
    Returns key -> (growth, standard error).

    Every artist has its own growth rate, but 30 noisy days can't pin one down: an artist that
    caught a viral spike looks like a rocket. So we blend each artist's own average with the
    average across all artists, trusting the artist's own number more when its data are steady
    and the artists clearly differ (empirical Bayes / partial pooling).
    """
    stats = {}
    for k, r in returns.items():
        r = np.sort(np.asarray(r, dtype=float))
        n = len(r)
        if n < 2:
            continue
        cut = int(trim * n)
        kept = r[cut:n - cut] if cut else r
        # Variance of a trimmed mean: winsorized variance / ((1 - 2*trim)^2 * n).
        wins = np.clip(r, kept[0], kept[-1])
        stats[k] = (float(kept.mean()), float(wins.var(ddof=1) / ((1 - 2 * cut / n) ** 2 * n)))
    if not stats:
        return {}
    means = np.array([m for m, _ in stats.values()])
    noise = np.array([v for _, v in stats.values()])
    market = float(means.mean())
    # Spread of true growth across artists = spread of observed means minus their sampling noise.
    spread = max(0.0, float(means.var(ddof=1)) - float(noise.mean())) if len(means) > 1 else 0.0
    out = {}
    for k, (m, v) in stats.items():
        trust = spread / (spread + v) if spread + v > 0 else 0.0
        out[k] = (market + trust * (m - market), float(np.sqrt(trust * v + (1 - trust) * noise.mean() / len(means))))
    return out
