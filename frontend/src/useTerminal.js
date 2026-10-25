import { useCallback, useEffect, useRef, useState } from 'react';
import { summarizeForecast } from './forecast.js';

const POLL_MS = 15000;

// The API sends type ("VIRAL SPIKE", "COLD STREAK", ...), headline, and impactPct (the event's shock, signed).
function normalizeEvent(e) {
  return {
    ...e,
    label: e.type.replace(/_/g, ' '),
    pricePct: e.impactPct ?? null,
    positive: (e.impactPct ?? 0) >= 0,
  };
}

/**
 * Loads market + account data from the API, keeps it fresh, and exposes trade / advance actions.
 * Each refresh resolves with the new { market, account } so callers can compare before/after.
 */
export function useTerminal(api, user) {
  const [market, setMarket] = useState(null);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState(null);
  const c = useRef({ prices: {}, version: 0, queue: Promise.resolve() });

  const loadMarket = useCallback(async () => {
    const s = c.current;
    const [m, events, board] = await Promise.all([api.market(), api.events(60), api.leaderboard(50)]);

    const flashes = {};
    const artists = {};
    for (const a of m.artists) {
      const before = s.prices[a.ticker];
      if (before !== undefined && before !== a.price) flashes[a.ticker] = a.price > before ? 'up' : 'down';
      s.prices[a.ticker] = a.price;
      artists[a.ticker] = { ...a, forecast: a.forecast ?? [], fc: summarizeForecast(a.forecast, a.price) };
    }
    if (Object.keys(flashes).length) s.version += 1;

    const next = {
      gameDate: m.gameDate,
      day: m.day,
      artists,
      events: events.map(normalizeEvent),
      leaderboard: board.map((p) => ({ ...p, kind: p.userId === user.id ? 'you' : p.kind })),
      flashes,
      version: s.version,
    };
    setMarket(next);
    return next;
  }, [api, user.id]);

  const loadAccount = useCallback(async () => {
    const [portfolio, transactions] = await Promise.all([api.portfolio(user.id), api.transactions(user.id)]);
    const next = {
      ...portfolio,
      holdings: Object.fromEntries(portfolio.holdings.map((h) => [h.ticker, h])),
      transactions,
    };
    setAccount(next);
    return next;
  }, [api, user.id]);

  // Refreshes run one at a time so a poll never overwrites a newer result.
  const refresh = useCallback(() => {
    const s = c.current;
    const run = s.queue.then(async () => {
      try {
        const [m, a] = await Promise.all([loadMarket(), loadAccount()]);
        setError(null);
        return { market: m, account: a };
      } catch (e) {
        setError(e);
        return null;
      }
    });
    s.queue = run;
    return run;
  }, [loadMarket, loadAccount]);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const trade = useCallback(
    async (side, ticker, shares) => {
      const result = await api.trade(user.id, ticker, side, shares);
      const after = await refresh();
      return { result, after };
    },
    [api, user.id, refresh],
  );

  const advance = useCallback(async () => {
    const results = await api.advanceDay(1);
    const after = await refresh();
    return { result: results[results.length - 1], after };
  }, [api, refresh]);

  return { market, account, error, refresh, trade, advance };
}
