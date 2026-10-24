import { useCallback, useEffect, useRef, useState } from 'react';
import { summarizeForecast } from './forecast.js';

const POLL_MS = 15000;

// The API sends type ("VIRAL SPIKE", "SCANDAL", ...), headline, and impactPct (the event's shock, signed).
function normalizeEvent(e) {
  return {
    ...e,
    label: e.type.replace(/_/g, ' '),
    pricePct: e.impactPct ?? null,
    positive: (e.impactPct ?? 0) >= 0,
  };
}

// The AI bot is whichever bot account has GPR or AI in its name.
function playerKind(p, userId) {
  if (p.userId === userId) return 'you';
  if (p.isBot) return /gpr|(^|_)ai($|_)/i.test(p.username) ? 'ai' : 'bot';
  return 'human';
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/**
 * Loads market + account data from the API, keeps it fresh, and exposes trade / advance actions.
 * History is only refetched when the game date changes; forecasts are refetched every poll
 * because the ML job writes them a little after each Advance Day.
 */
export function useTerminal(api, user) {
  const [market, setMarket] = useState(null);
  const [account, setAccount] = useState(null);
  const [error, setError] = useState(null);
  const c = useRef({ date: null, histories: {}, prices: {}, board: {}, prevBoard: {}, version: 0, queue: Promise.resolve() });

  const loadMarket = useCallback(async () => {
    const s = c.current;
    const [game, artists, events, board] = await Promise.all([
      api.game(),
      api.artists(),
      api.events(60),
      api.leaderboard(50),
    ]);
    const newDay = game.gameDate !== s.date;
    const [histories, forecasts] = await Promise.all([
      newDay ? Promise.all(artists.map((a) => api.history(a.id))) : null,
      Promise.all(artists.map((a) => api.forecast(a.id).catch(() => []))),
    ]);
    if (newDay) {
      artists.forEach((a, i) => (s.histories[a.ticker] = histories[i]));
      if (s.date) s.prevBoard = s.board;
      s.date = game.gameDate;
    }

    const flashes = {};
    const byTicker = {};
    artists.forEach((a, i) => {
      const before = s.prices[a.ticker];
      if (before !== undefined && before !== a.price) flashes[a.ticker] = a.price > before ? 'up' : 'down';
      s.prices[a.ticker] = a.price;
      const history = s.histories[a.ticker] ?? [];
      const last = history[history.length - 1];
      const prev = history[history.length - 2];
      byTicker[a.ticker] = {
        ...a,
        change: a.price - a.price / (1 + a.changePct / 100),
        listenersChangePct: last && prev ? ((last.listeners - prev.listeners) / prev.listeners) * 100 : 0,
        history,
        forecast: forecasts[i] ?? [],
        fc: summarizeForecast(forecasts[i], a.price),
      };
    });
    if (Object.keys(flashes).length) s.version += 1;

    s.board = Object.fromEntries(board.map((p) => [p.userId, p.totalValue]));
    const firstDate = Object.values(byTicker)[0]?.history[0]?.date ?? game.gameDate;

    setMarket({
      gameDate: game.gameDate,
      dayNumber: daysBetween(firstDate, game.gameDate),
      artists: byTicker,
      events: events.map(normalizeEvent),
      leaderboard: board.map((p) => ({ ...p, kind: playerKind(p, user.id), prevValue: s.prevBoard[p.userId] })),
      flashes,
      version: s.version,
    });
  }, [api, user.id]);

  const loadAccount = useCallback(async () => {
    const [portfolio, transactions] = await Promise.all([api.portfolio(user.id), api.transactions(user.id)]);
    setAccount({
      ...portfolio,
      holdings: Object.fromEntries(portfolio.holdings.map((h) => [h.ticker, h])),
      transactions,
    });
  }, [api, user.id]);

  // Refreshes run one at a time so a poll never overwrites a newer result.
  const refresh = useCallback(() => {
    const s = c.current;
    s.queue = s.queue
      .then(() => Promise.all([loadMarket(), loadAccount()]))
      .then(() => setError(null))
      .catch((e) => setError(e));
    return s.queue;
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
      const r = await api.trade(user.id, ticker, side, shares);
      await refresh();
      return r;
    },
    [api, user.id, refresh],
  );

  const advance = useCallback(async () => {
    const results = await api.advanceDay(1);
    await refresh();
    return results[results.length - 1];
  }, [api, refresh]);

  return { market, account, error, refresh, trade, advance };
}
