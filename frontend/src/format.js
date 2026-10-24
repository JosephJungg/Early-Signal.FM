export const num = (n, d = 2) =>
  Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export const signed = (n, d = 2) => `${n >= 0 ? '+' : ''}${num(n, d)}`;
export const pct = (n, d = 2) => `${n >= 0 ? '+' : ''}${num(n, d)}%`;
export const tone = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat');
export const arrow = (n) => (n > 0 ? '▲' : n < 0 ? '▼' : '■');

export const compact = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
};
