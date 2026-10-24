"""Gaussian process price forecasts.

We model log-price against day index. Daily moves in the price engine are a noisy random walk
with drift, so the candidate kernels are:
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


def forecast(prices, horizon: int = 7, kernel: str = "ou", drift: float = 0.0, drift_se: float = 0.0,
             boost: float = 0.0):
    """Fit on a price series (oldest first) and forecast the next `horizon` days.

    drift: expected daily log-return for this artist's tier (see tier_drift). The GP models how
           the price wanders around that trend, so the forecast keeps rising with the tier.
    drift_se: standard error of that estimate; widens the band further out, where a wrong
           drift compounds.
    boost: artists.release_boost; adds the part of a recent release the engine still owes.

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
    mu = mu + drift * days[n:] + release_boosts(boost, horizon)
    sd = np.sqrt(sd**2 + (drift_se * np.arange(1, horizon + 1)) ** 2)
    band = Z90 * BAND_SCALE * sd
    return np.exp(mu), np.exp(mu - band), np.exp(mu + band)


def tier_drift(return_series) -> tuple[float, float]:
    """Average daily log-return pooled over every artist in a tier.

    One artist's 30 days are too noisy to estimate a trend; ~7 artists x 30 days are not.
    Include release days: the average then carries the expected value of releases that haven't
    happened yet, while forecast()'s boost covers only what a past release still owes.
    Returns (mean, standard error).
    """
    pooled = np.concatenate([np.asarray(r, dtype=float) for r in return_series if len(r)] or [[]])
    if len(pooled) < 2:
        return 0.0, 0.0
    return float(pooled.mean()), float(pooled.std(ddof=1) / np.sqrt(len(pooled)))


def release_boosts(boost: float, horizon: int = 7) -> np.ndarray:
    """Cumulative log-return still owed by a recent release, for each of the next `horizon` days.

    Mirrors PriceEngine: artists.release_boost is added to tomorrow's return, then halves each
    day and drops to zero once it falls below 0.005. So a 0.03 boost adds 0.03, 0.015, 0.0075.
    """
    owed, total, b = [], 0.0, float(boost)
    for _ in range(horizon):
        if b < 0.005:
            b = 0.0
        total += b
        owed.append(total)
        b *= 0.5
    return np.array(owed)
