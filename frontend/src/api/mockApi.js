// In-browser fake of the Spring Boot API: same endpoints, same response shapes, same rules.
// Use it when the backend isn't running (VITE_DATA_SOURCE=mock, or the button on the error screen).
import { ApiError } from './client.js';
import { FEE_RATE, POSITION_CAP } from '../trading.js';

const STARTING_CASH = 10000;
const HISTORY_DAYS = 30;
const START_MS = Date.UTC(2026, 8, 24);
const dayToDate = (d) => new Date(START_MS + d * 86400000).toISOString().slice(0, 10);

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(1028);
const gauss = () => {
  let u = 0;
  let v = 0;
  while (!u) u = rand();
  while (!v) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const cents = (n) => Math.round(n * 100) / 100;

// Same 20 artists the backend seeds.
const SEEDS = [
  ['ORIN', 'Orion Kade', 'BLUE_CHIP', 245.0, 48_000_000],
  ['SOL', 'Solace', 'BLUE_CHIP', 198.5, 41_500_000],
  ['MARA', 'Mara Quinn', 'BLUE_CHIP', 176.2, 36_200_000],
  ['JUNO', 'Juno Ray', 'BLUE_CHIP', 154.75, 31_800_000],
  ['ATLS', 'Atlas Grey', 'BLUE_CHIP', 132.4, 27_400_000],
  ['KAI', 'Kai Mercer', 'MID', 78.3, 7_600_000],
  ['VELA', 'Vela Hart', 'MID', 64.1, 5_900_000],
  ['NOVA', 'Nova Bloom', 'MID', 58.9, 5_100_000],
  ['REX', 'Rex Arden', 'MID', 51.25, 4_300_000],
  ['IVY', 'Ivy Lane', 'MID', 46.6, 3_700_000],
  ['TIDE', 'Talon and the Tide', 'MID', 42.15, 3_100_000],
  ['ECHO', 'Echo Park Kids', 'MID', 38.8, 2_400_000],
  ['LUNA', 'Luna Vale', 'UNDERGROUND', 18.4, 380_000],
  ['MOTH', 'Moth Radio', 'UNDERGROUND', 15.2, 310_000],
  ['FERN', 'Fern Atlas', 'UNDERGROUND', 12.75, 245_000],
  ['GLOW', 'Glowworm Choir', 'UNDERGROUND', 10.9, 190_000],
  ['DUSK', 'Dusk Theory', 'UNDERGROUND', 9.35, 150_000],
  ['PIXL', 'Pixel Saints', 'UNDERGROUND', 7.8, 112_000],
  ['RUE', 'Rue Marlow', 'UNDERGROUND', 6.4, 84_000],
  ['ZEPH', 'Zephyr Static', 'UNDERGROUND', 5.1, 56_000],
];
const TIER = {
  BLUE_CHIP: { vol: 0.012, drift: 0.001, pViral: 0.005 },
  MID: { vol: 0.025, drift: 0.003, pViral: 0.02 },
  UNDERGROUND: { vol: 0.05, drift: 0.006, pViral: 0.04 },
};

const BOTS = [
  { username: 'ES_GPR_AI', mu: 0.006, sigma: 0.018 },
  { username: 'momentum_bot', mu: 0.003, sigma: 0.03 },
  { username: 'random_bot', mu: 0.0, sigma: 0.025 },
  { username: 'hodl_bot', mu: 0.002, sigma: 0.012 },
];
const RIVALS = [
  { username: 'beatfiend', mu: 0.004, sigma: 0.035 },
  { username: 'vinylvault', mu: 0.001, sigma: 0.02 },
  { username: 'mx_tilde', mu: 0.002, sigma: 0.04 },
];

let db = null;

function stepArtist(a) {
  const t = TIER[a.tier];
  let growth = t.drift + 0.5 * t.vol * gauss();
  let type = null;
  const roll = rand();
  const pDrop = a.tier === 'UNDERGROUND' ? 0.03 : 0.015;
  if (roll < t.pViral) {
    growth += 0.15 + 0.25 * rand();
    type = 'VIRAL_SPIKE';
  } else if (roll < t.pViral + pDrop) {
    growth -= 0.08 + 0.12 * rand();
    type = 'LISTENER_DROP';
  } else if (roll < t.pViral + pDrop + 0.03) {
    a.boost = 0.06;
    type = 'NEW_RELEASE';
  }
  const ret = Math.max(-0.25, Math.min(0.25, 0.8 * growth + a.boost + t.vol * gauss()));
  const prev = a.price;
  const prevListeners = a.listeners;
  a.prevPrice = prev;
  a.price = Math.max(0.5, cents(prev * Math.exp(ret)));
  a.listeners = Math.max(1000, Math.round(a.listeners * (1 + growth)));
  a.boost = a.boost * 0.5 < 0.005 ? 0 : a.boost * 0.5;
  a.history.push({ date: dayToDate(db.day), price: a.price, listeners: a.listeners });
  if (!type) return null;
  const pricePct = ((a.price - prev) / prev) * 100;
  const listenerPct = ((a.listeners - prevListeners) / prevListeners) * 100;
  const sign = (n, d) => `${n >= 0 ? '+' : ''}${n.toFixed(d)}`;
  const message =
    type === 'VIRAL_SPIKE'
      ? `VIRAL SPIKE: ${a.ticker} listeners ${sign(listenerPct, 0)}%, price ${sign(pricePct, 1)}%`
      : type === 'LISTENER_DROP'
        ? `LISTENER DROP: ${a.ticker} listeners ${sign(listenerPct, 0)}%, price ${sign(pricePct, 1)}%`
        : `NEW RELEASE: ${a.ticker} drops new music, price ${sign(pricePct, 1)}%`;
  return { id: ++db.eventSeq, artistId: a.id, ticker: a.ticker, type, message, date: dayToDate(db.day) };
}

function advanceOne() {
  db.day += 1;
  const events = db.artists.map(stepArtist).filter(Boolean);
  db.events.unshift(...events.reverse());
  for (const u of db.users) {
    if (u.sim) u.simValue *= Math.exp(u.mu + u.sigma * gauss());
  }
  return { gameDate: dayToDate(db.day), artistsUpdated: db.artists.length, events };
}

function init() {
  db = { day: 0, artists: [], events: [], users: [], transactions: [], eventSeq: 0, txSeq: 0 };
  db.artists = SEEDS.map(([ticker, name, tier, price, listeners], i) => ({
    id: i + 1,
    ticker,
    name,
    tier,
    price,
    prevPrice: price,
    listeners,
    boost: 0,
    history: [{ date: dayToDate(0), price, listeners }],
  }));
  for (const [i, p] of [...BOTS, ...RIVALS].entries()) {
    db.users.push({ id: i + 1, username: p.username, isBot: BOTS.includes(p), cash: STARTING_CASH, holdings: {}, sim: true, simValue: STARTING_CASH, ...p });
  }
  for (let d = 0; d < HISTORY_DAYS; d++) advanceOne();
}

const artistBy = (idOrTicker) =>
  db.artists.find((a) => a.id === Number(idOrTicker) || a.ticker === String(idOrTicker).toUpperCase());
const userBy = (id) => {
  const u = db.users.find((x) => x.id === Number(id));
  if (!u) throw new ApiError(`Unknown user: ${id}`, { status: 404 });
  return u;
};
const holdingsValue = (u) =>
  Object.entries(u.holdings).reduce((s, [id, h]) => s + h.shares * artistBy(id).price, 0);
const totalValue = (u) => (u.sim ? u.simValue : u.cash + holdingsValue(u));

// Placeholder forecast until the ML job exists: drift from recent returns, band from volatility.
function mockForecast(a) {
  const h = a.history.slice(-15);
  const rets = h.slice(1).map((p, i) => Math.log(p.price / h[i].price));
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const sd = Math.max(0.01, Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length));
  const mu = mean * 0.5;
  return Array.from({ length: 7 }, (_, i) => {
    const k = i + 1;
    const band = 1.645 * sd * Math.sqrt(k);
    return {
      date: dayToDate(db.day + k),
      mean: cents(a.price * Math.exp(mu * k)),
      lower: cents(a.price * Math.exp(mu * k - band)),
      upper: cents(a.price * Math.exp(mu * k + band)),
    };
  });
}

const ok = (v) => Promise.resolve(structuredClone(v));

export const mockApi = {
  source: 'mock',
  async createUser(username) {
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      throw new ApiError('Username must be 3-20 letters, numbers, or underscores', { status: 400 });
    }
    let u = db.users.find((x) => x.username.toLowerCase() === username.toLowerCase());
    if (!u) {
      u = { id: db.users.length + 1, username, isBot: false, cash: STARTING_CASH, holdings: {} };
      db.users.push(u);
    }
    return ok({ id: u.id, username: u.username, cash: u.cash, isBot: u.isBot });
  },
  game: () => ok({ gameDate: dayToDate(db.day) }),
  artists: () =>
    ok(
      [...db.artists]
        .sort((a, b) => a.ticker.localeCompare(b.ticker))
        .map((a) => ({
          id: a.id,
          ticker: a.ticker,
          name: a.name,
          tier: a.tier,
          price: a.price,
          changePct: ((a.price - a.prevPrice) / a.prevPrice) * 100,
          listeners: a.listeners,
        })),
    ),
  history: (id) => ok(artistBy(id).history),
  forecast: (id) => ok(mockForecast(artistBy(id))),
  events: (limit = 60) => ok(db.events.slice(0, limit)),
  async portfolio(userId) {
    const u = userBy(userId);
    const holdings = Object.entries(u.holdings).map(([id, h]) => {
      const a = artistBy(id);
      return { artistId: a.id, ticker: a.ticker, shares: h.shares, avgCost: h.avgCost, price: a.price, value: cents(h.shares * a.price) };
    });
    const hv = holdingsValue(u);
    return ok({ userId: u.id, username: u.username, cash: u.cash, holdingsValue: cents(hv), totalValue: cents(u.cash + hv), holdings });
  },
  transactions: (userId) => ok(db.transactions.filter((t) => t.userId === Number(userId))),
  leaderboard: (limit = 50) =>
    ok(
      [...db.users]
        .sort((a, b) => totalValue(b) - totalValue(a))
        .slice(0, limit)
        .map((u, i) => ({ rank: i + 1, userId: u.id, username: u.username, totalValue: cents(totalValue(u)), isBot: u.isBot })),
    ),
  async trade(userId, ticker, side, shares) {
    const u = userBy(userId);
    const a = artistBy(ticker);
    if (!a) throw new ApiError(`Unknown artist: ${ticker}`, { status: 404 });
    if (!Number.isInteger(shares) || shares <= 0) throw new ApiError('Shares must be a positive whole number', { status: 400 });
    const notional = cents(a.price * shares);
    const fee = cents(notional * FEE_RATE);
    const h = u.holdings[a.id] ?? { shares: 0, avgCost: 0 };
    if (side === 'BUY') {
      if (u.cash < notional + fee) throw new ApiError(`Insufficient credits: need ${(notional + fee).toFixed(2)}, have ${u.cash.toFixed(2)}`, { status: 400 });
      const after = u.cash - notional - fee + holdingsValue(u) + notional;
      if ((h.shares + shares) * a.price > after * POSITION_CAP) {
        throw new ApiError(`Position limit: max ${POSITION_CAP * 100}% of portfolio in one artist`, { status: 400 });
      }
      u.cash = cents(u.cash - notional - fee);
      u.holdings[a.id] = { shares: h.shares + shares, avgCost: cents((h.avgCost * h.shares + notional) / (h.shares + shares)) };
    } else {
      if (h.shares < shares) throw new ApiError(`You only hold ${h.shares} shares of ${a.ticker}`, { status: 400 });
      u.cash = cents(u.cash + notional - fee);
      if (h.shares === shares) delete u.holdings[a.id];
      else u.holdings[a.id] = { ...h, shares: h.shares - shares };
    }
    const tx = { id: ++db.txSeq, userId: u.id, artistId: a.id, ticker: a.ticker, side, shares, price: a.price, fee, gameDate: dayToDate(db.day) };
    db.transactions.unshift(tx);
    return ok({ transactionId: tx.id, side, ticker: a.ticker, shares, price: a.price, fee, cash: u.cash });
  },
  advanceDay: (days = 1) => ok(Array.from({ length: days }, advanceOne)),
};

init();
