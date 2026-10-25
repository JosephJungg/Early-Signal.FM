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

// Same 24 artists the backend seeds (backend DataSeeder): ticker, name, genre, price, listeners, drift, vol.
const SEEDS = [
  ['LUNA', 'Luna Vega', 'Indie Pop', 18.4, 1_840_000, 0.01, 0.045],
  ['KAI', 'Kai Mercer', 'Hip-Hop', 42.1, 6_200_000, 0.004, 0.03],
  ['NOVA', 'Nova Reyes', 'Alt R&B', 27.6, 3_100_000, 0.006, 0.035],
  ['ECHO', 'Echo Park Kids', 'Indie Rock', 12.9, 920_000, 0.003, 0.05],
  ['JADE', 'Jade Okafor', 'Afrobeats', 35.2, 4_700_000, 0.008, 0.032],
  ['RIOT', 'Riot Saints', 'Punk', 6.4, 310_000, 0.0, 0.07],
  ['VELV', 'Velvet Hours', 'Dream Pop', 9.8, 640_000, 0.007, 0.055],
  ['ORCA', 'Orca Bloom', 'Electronic', 22.3, 2_250_000, 0.005, 0.04],
  ['MIRA', 'Mira Sol', 'Latin Pop', 51.7, 9_800_000, 0.003, 0.022],
  ['DUST', 'Dustwalker', 'Country', 30.5, 3_600_000, 0.002, 0.025],
  ['ZENO', 'Zeno', 'Hyperpop', 4.2, 180_000, 0.012, 0.085],
  ['SAGE', 'Sage & Iron', 'Folk', 14.6, 1_120_000, 0.001, 0.03],
  ['BLKS', 'Black Static', 'Metal', 11.3, 780_000, -0.001, 0.038],
  ['CRUZ', 'Cruz Delgado', 'Reggaeton', 46.8, 8_100_000, 0.004, 0.028],
  ['HALO', 'Halo Theory', 'EDM', 19.9, 2_000_000, -0.002, 0.042],
  ['PIXL', 'Pixel Ghost', 'Lo-fi', 7.1, 520_000, 0.006, 0.048],
  ['RAVN', 'Raven Ash', 'Alt Rock', 16.2, 1_380_000, 0.001, 0.036],
  ['TIDE', 'Tidewater', 'Indie Folk', 10.4, 700_000, 0.004, 0.04],
  ['KOI', 'Koi Lantern', 'Bedroom Pop', 5.6, 260_000, 0.011, 0.075],
  ['FLUX', 'Flux Avenue', 'House', 24.8, 2_600_000, 0.003, 0.033],
  ['IRIS', 'Iris Lane', 'Singer-Songwriter', 21.5, 2_050_000, 0.005, 0.031],
  ['DRFT', 'Drift Theory', 'Synthwave', 8.9, 590_000, 0.002, 0.044],
  ['APEX', 'Apex Rho', 'Drill', 13.7, 1_450_000, 0.006, 0.058],
  ['SOLR', 'Solaris Twins', 'Pop', 61.3, 12_400_000, 0.002, 0.02],
];
const tierOf = (listeners) => (listeners >= 5_000_000 ? 'BLUE_CHIP' : listeners >= 1_000_000 ? 'MID' : 'UNDERGROUND');

const BOTS = [
  { username: 'ES-GPR', kind: 'ai', mu: 0.006, sigma: 0.018 },
  { username: 'MOMENTUM-BOT', kind: 'bot', mu: 0.003, sigma: 0.03 },
  { username: 'RANDOM-BOT', kind: 'bot', mu: 0.0, sigma: 0.025 },
  { username: 'HODL-BOT', kind: 'bot', mu: 0.002, sigma: 0.012 },
];
const RIVALS = [
  { username: 'beatfiend', mu: 0.004, sigma: 0.035 },
  { username: 'vinylvault', mu: 0.001, sigma: 0.02 },
  { username: 'mx_tilde', mu: 0.002, sigma: 0.04 },
];

// Same event types and impact ranges as backend PriceEngine.
const EVENT_KINDS = [
  { type: 'VIRAL SPIKE', min: 0.15, max: 0.4, text: (n) => `${n} track explodes on short-form video` },
  { type: 'PLAYLIST ADD', min: 0.05, max: 0.12, text: (n) => `${n} added to a major editorial playlist` },
  { type: 'TOUR ANNOUNCED', min: 0.03, max: 0.08, text: (n) => `${n} announces 30-city tour` },
  { type: 'LABEL SIGNING', min: 0.06, max: 0.15, text: (n) => `${n} signs with a major label` },
  { type: 'COLLAB DROP', min: 0.04, max: 0.1, text: (n) => `Surprise collab featuring ${n} drops overnight` },
  { type: 'ALBUM DELAY', min: -0.1, max: -0.04, text: (n) => `${n} pushes album release to next year` },
  { type: 'SCANDAL', min: -0.25, max: -0.1, text: (n) => `${n} under fire after leaked comments` },
];

let db = null;

function stepArtist(a) {
  let growth = a.drift + 0.5 * a.vol * gauss();
  let ret = 0.8 * growth + a.vol * gauss();
  let kind = null;
  let impact = 0;
  if (rand() < 0.07) {
    kind = EVENT_KINDS[Math.floor(rand() * EVENT_KINDS.length)];
    impact = kind.min + rand() * (kind.max - kind.min);
    ret += impact;
    growth += 0.6 * impact;
  }
  ret = Math.max(-0.45, Math.min(0.45, ret));
  a.prevPrice = a.price;
  a.prevListeners = a.listeners;
  a.price = Math.max(0.5, cents(a.price * Math.exp(ret)));
  a.listeners = Math.max(1000, Math.round(a.listeners * (1 + growth)));
  a.history.push({ date: dayToDate(db.day), day: db.day, price: a.price, listeners: a.listeners });
  if (!kind) return null;
  return {
    id: ++db.eventSeq,
    artistId: a.id,
    ticker: a.ticker,
    type: kind.type,
    headline: kind.text(a.name),
    impactPct: Math.round(impact * 1000) / 10,
    date: dayToDate(db.day),
    day: db.day,
  };
}

function advanceOne() {
  db.day += 1;
  const events = db.artists.map(stepArtist).filter(Boolean);
  db.events.unshift(...events.reverse());
  for (const u of db.users) {
    if (!u.sim) continue;
    u.prevSimValue = u.simValue;
    u.simValue *= Math.exp(u.mu + u.sigma * gauss());
  }
  return { gameDate: dayToDate(db.day), day: db.day, artistsUpdated: db.artists.length, events };
}

function init() {
  db = { day: 0, artists: [], events: [], users: [], transactions: [], eventSeq: 0, txSeq: 0 };
  db.artists = SEEDS.map(([ticker, name, genre, price, listeners, drift, vol], i) => ({
    id: i + 1,
    ticker,
    name,
    genre,
    drift,
    vol,
    price,
    prevPrice: price,
    listeners,
    prevListeners: listeners,
    history: [{ date: dayToDate(0), day: 0, price, listeners }],
  }));
  for (const [i, p] of [...BOTS, ...RIVALS].entries()) {
    db.users.push({
      id: i + 1,
      kind: 'human',
      ...p,
      isBot: BOTS.includes(p),
      cash: STARTING_CASH,
      holdings: {},
      sim: true,
      simValue: STARTING_CASH,
      prevSimValue: STARTING_CASH,
    });
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
// Cash plus holdings at yesterday's prices, like the backend's prevValue.
const prevValue = (u) =>
  u.sim
    ? u.prevSimValue
    : u.cash + Object.entries(u.holdings).reduce((s, [id, h]) => s + h.shares * artistBy(id).prevPrice, 0);

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
      day: db.day + k,
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
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(username)) {
      throw new ApiError('Username must be 3-20 letters, numbers, underscores, or hyphens', { status: 400 });
    }
    let u = db.users.find((x) => x.username.toLowerCase() === username.toLowerCase());
    if (!u) {
      u = { id: db.users.length + 1, username, kind: 'human', isBot: false, cash: STARTING_CASH, holdings: {} };
      db.users.push(u);
    }
    return ok({ id: u.id, username: u.username, cash: u.cash, isBot: u.isBot, kind: u.kind });
  },
  game: () => ok({ gameDate: dayToDate(db.day), day: db.day }),
  market: () =>
    ok({
      gameDate: dayToDate(db.day),
      day: db.day,
      artists: [...db.artists]
        .sort((a, b) => a.ticker.localeCompare(b.ticker))
        .map((a) => ({
          id: a.id,
          ticker: a.ticker,
          name: a.name,
          genre: a.genre,
          tier: tierOf(a.listeners),
          price: a.price,
          change: cents(a.price - a.prevPrice),
          changePct: ((a.price - a.prevPrice) / a.prevPrice) * 100,
          listeners: a.listeners,
          listenersChangePct: ((a.listeners - a.prevListeners) / a.prevListeners) * 100,
          history: a.history,
          forecast: mockForecast(a),
        })),
    }),
  artists: () =>
    ok(
      [...db.artists]
        .sort((a, b) => a.ticker.localeCompare(b.ticker))
        .map((a) => ({
          id: a.id,
          ticker: a.ticker,
          name: a.name,
          genre: a.genre,
          tier: tierOf(a.listeners),
          price: a.price,
          changePct: ((a.price - a.prevPrice) / a.prevPrice) * 100,
          listeners: a.listeners,
        })),
    ),
  history: (id) => ok(artistBy(id).history),
  forecast: (id) => ok(mockForecast(artistBy(id))),
  events: (limit = 60) => ok(db.events.slice(0, limit)),
  // Each player's first buy of this artist, earliest first (same as the backend's /fans).
  async fans(id, limit = 50) {
    const a = artistBy(id);
    if (!a) throw new ApiError(`Unknown artist: ${id}`, { status: 404 });
    const firsts = new Map();
    for (const tx of [...db.transactions].reverse()) {
      if (tx.artistId === a.id && tx.side === 'BUY' && !firsts.has(tx.userId)) firsts.set(tx.userId, tx);
    }
    return ok(
      [...firsts.values()].slice(0, limit).map((tx, i) => {
        const u = userBy(tx.userId);
        return {
          rank: i + 1,
          userId: u.id,
          username: u.username,
          kind: u.kind,
          isBot: u.isBot,
          since: tx.gameDate,
          day: tx.day,
          firstPrice: tx.price,
          shares: u.holdings[a.id]?.shares ?? 0,
        };
      }),
    );
  },
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
        .map((u, i) => ({
          rank: i + 1,
          userId: u.id,
          username: u.username,
          kind: u.kind,
          isBot: u.isBot,
          totalValue: cents(totalValue(u)),
          prevValue: cents(prevValue(u)),
        })),
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
    const tx = { id: ++db.txSeq, userId: u.id, artistId: a.id, ticker: a.ticker, side, shares, price: a.price, fee, gameDate: dayToDate(db.day), day: db.day };
    db.transactions.unshift(tx);
    return ok({ transactionId: tx.id, side, ticker: a.ticker, shares, price: a.price, fee, cash: u.cash });
  },
  advanceDay: (days = 1) => ok(Array.from({ length: days }, advanceOne)),
};

init();
