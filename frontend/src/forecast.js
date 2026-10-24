// Turns the API's forecast rows ([{date, mean, lower, upper}], dates after the game date)
// into what the terminal shows: expected return, band width, and a simple signal.
export function summarizeForecast(points, price) {
  if (!points?.length || !price) return null;
  const end = points[points.length - 1];
  const expRet = end.mean / price - 1;
  const uncertainty = Math.max(1e-9, (end.upper - end.lower) / 2 / price);
  const score = expRet / uncertainty;
  const signal = score > 0.2 ? 'BUY' : score < -0.2 ? 'SELL' : 'HOLD';
  return { points, end, expRet, uncertainty, score, signal };
}
