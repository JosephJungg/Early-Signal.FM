// Local stand-in for the Spring Boot API so the UI can be built before the backend is live.
// Rules mirror the plan: 10,000 starting credits, 1% fee, 30% position cap, Advance Day.
// When the real API is up, swap these calls for fetches that return the same shapes.

export const STARTING_CASH = 10000;
export const FEE_RATE = 0.01;
export const POSITION_CAP = 0.3;

const HISTORY_DAYS = 30; // days of price history before "today"
const GAME_START_DAY = 24; // players joined the game on this day
const START_MS = Date.UTC(2026, 8, 1);

export const dayToDate = (d) => new Date(START_MS + d * 86400000).toISOString().slice(0, 10);

// Seeded RNG so the mock market looks the same on every reload.
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
const between = (min, max) => min + rand() * (max - min);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// [ticker, name, genre, starting price, monthly listeners, daily drift, daily vol]
const ARTIST_SEED = [
  ['LUNA', 'Luna Vega', 'Indie Pop', 18.4, 1_840_000, 0.010, 0.045],
  ['KAI', 'Kai Mercer', 'Hip-Hop', 42.1, 6_200_000, 0.004, 0.030],
  ['NOVA', 'Nova Reyes', 'Alt R&B', 27.6, 3_100_000, 0.006, 0.035],
  ['ECHO', 'Echo Park Kids', 'Indie Rock', 12.9, 920_000, 0.003, 0.050],
  ['JADE', 'Jade Okafor', 'Afrobeats', 35.2, 4_700_000, 0.008, 0.032],
  ['RIOT', 'Riot Saints', 'Punk', 6.4, 310_000, 0.000, 0.070],
  ['VELV', 'Velvet Hours', 'Dream Pop', 9.8, 640_000, 0.007, 0.055],
  ['ORCA', 'Orca Bloom', 'Electronic', 22.3, 2_250_000, 0.005, 0.040],
  ['MIRA', 'Mira Sol', 'Latin Pop', 51.7, 9_800_000, 0.003, 0.022],
  ['DUST', 'Dustwalker', 'Country', 30.5, 3_600_000, 0.002, 0.025],
  ['ZENO', 'Zeno', 'Hyperpop', 4.2, 180_000, 0.012, 0.085],
  ['SAGE', 'Sage & Iron', 'Folk', 14.6, 1_120_000, 0.001, 0.030],
  ['BLKS', 'Black Static', 'Metal', 11.3, 780_000, -0.001, 0.038],
  ['CRUZ', 'Cruz Delgado', 'Reggaeton', 46.8, 8_100_000, 0.004, 0.028],
  ['HALO', 'Halo Theory', 'EDM', 19.9, 2_000_000, -0.002, 0.042],
  ['PIXL', 'Pixel Ghost', 'Lo-fi', 7.1, 520_000, 0.006, 0.048],
  ['RAVN', 'Raven Ash', 'Alt Rock', 16.2, 1_380_000, 0.001, 0.036],
  ['TIDE', 'Tidewater', 'Indie Folk', 10.4, 700_000, 0.004, 0.040],
  ['KOI', 'Koi Lantern', 'Bedroom Pop', 5.6, 260_000, 0.011, 0.075],
  ['FLUX', 'Flux Avenue', 'House', 24.8, 2_600_000, 0.003, 0.033],
  ['IRIS', 'Iris Lane', 'Singer-Songwriter', 21.5, 2_050_000, 0.005, 0.031],
  ['DRFT', 'Drift Theory', 'Synthwave', 8.9, 590_000, 0.002, 0.044],
  ['APEX', 'Apex Rho', 'Drill', 13.7, 1_450_000, 0.006, 0.058],
  ['SOLR', 'Solaris Twins', 'Pop', 61.3, 12_400_000, 0.002, 0.020],
];

const EVENT_TYPES = [
  { type: 'VIRAL SPIKE', min: 0.15, max: 0.4, text: (a) => `${a.name} track explodes on short-form video` },
  { type: 'PLAYLIST ADD', min: 0.05, max: 0.12, text: (a) => `${a.name} added to a major editorial playlist` },
  { type: 'TOUR ANNOUNCED', min: 0.03, max: 0.08, text: (a) => `${a.name} announces 30-city tour` },
  { type: 'LABEL SIGNING', min: 0.06, max: 0.15, text: (a) => `${a.name} signs with a major label` },
  { type: 'COLLAB DROP', min: 0.04, max: 0.1, text: (a) => `Surprise collab featuring ${a.name} drops overnight` },
  { type: 'ALBUM DELAY', min: -0.1, max: -0.04, text: (a) => `${a.name} pushes album release to next year` },
  { type: 'SCANDAL', min: -0.25, max: -0.1, text: (a) => `${a.name} under fire after leaked comments` },
];

function stepArtist(meta, prev, day, eventChance) {
  let ret = meta.drift + meta.vol * gauss();
  let event = null;
  if (rand() < eventChance) {
    const kind = pick(EVENT_TYPES);
    const impact = between(kind.min, kind.max);
    ret += impact;
    event = { day, date: dayToDate(day), ticker: meta.ticker, type: kind.type, headline: kind.text(meta), impactPct: impact * 100 };
  }
  const price = Math.max(0.5, prev.price * Math.exp(ret));
  const listeners = Math.round(prev.listeners * (1 + ret * 0.6 + 0.004 * gauss()));
  return { point: { day, date: dayToDate(day), price: +price.toFixed(2), listeners }, event };
}

const PLAYER_SEED = [
  { id: 'you', name: 'YOU', kind: 'you' },
  { id: 'gpr', name: 'ES-GPR', kind: 'ai', mu: 0.006, sigma: 0.018 },
  { id: 'mom', name: 'MOMENTUM-BOT', kind: 'bot', mu: 0.003, sigma: 0.03 },
  { id: 'rnd', name: 'RANDOM-BOT', kind: 'bot', mu: 0.0, sigma: 0.025 },
  { id: 'hodl', name: 'HODL-BOT', kind: 'bot', mu: 0.002, sigma: 0.012 },
  { id: 'p1', name: 'beatfiend', kind: 'human', mu: 0.004, sigma: 0.035 },
  { id: 'p2', name: 'vinylvault', kind: 'human', mu: 0.001, sigma: 0.02 },
  { id: 'p3', name: 'mx_tilde', kind: 'human', mu: 0.002, sigma: 0.04 },
  { id: 'p4', name: 'lofi_larry', kind: 'human', mu: -0.001, sigma: 0.03 },
];

function stepPlayer(p) {
  const value = p.value * Math.exp(p.mu + p.sigma * gauss());
  return { ...p, prevValue: p.value, value };
}

export const lastPoint = (a) => a.history[a.history.length - 1];
export const prevPoint = (a) => a.history[a.history.length - 2] ?? lastPoint(a);

export function quote(a) {
  const last = lastPoint(a);
  const prev = prevPoint(a);
  const change = last.price - prev.price;
  return {
    price: last.price,
    change,
    changePct: (change / prev.price) * 100,
    listeners: last.listeners,
    listenersChangePct: ((last.listeners - prev.listeners) / prev.listeners) * 100,
  };
}

export function createInitialState() {
  const artists = {};
  const events = [];
  for (const [ticker, name, genre, price, listeners, drift, vol] of ARTIST_SEED) {
    const meta = { ticker, name, genre, drift, vol };
    const history = [{ day: 0, date: dayToDate(0), price, listeners }];
    for (let d = 1; d < HISTORY_DAYS; d++) {
      const { point, event } = stepArtist(meta, history[d - 1], d, 0.03);
      history.push(point);
      if (event) events.unshift(event);
    }
    artists[ticker] = { ...meta, history };
  }
  const day = HISTORY_DAYS - 1;

  // Seed the human player with a few positions bought on the game's first day.
  const holdings = {};
  let cash = STARTING_CASH;
  const transactions = [];
  for (const [ticker, shares] of [['LUNA', 60], ['ORCA', 40], ['KAI', 20]]) {
    const px = artists[ticker].history[GAME_START_DAY].price;
    const fee = px * shares * FEE_RATE;
    cash -= px * shares + fee;
    holdings[ticker] = { shares, avgCost: px };
    transactions.unshift({ day: GAME_START_DAY, side: 'BUY', ticker, shares, price: px, fee });
  }

  // Everyone else has been trading since GAME_START_DAY too.
  let players = PLAYER_SEED.map((p) => ({ ...p, value: STARTING_CASH, prevValue: STARTING_CASH }));
  for (let d = GAME_START_DAY; d < day; d++) {
    players = players.map((p) => (p.kind === 'you' ? p : stepPlayer(p)));
  }

  const state = {
    day,
    artists,
    events: events.slice(0, 40),
    portfolio: { cash, holdings, transactions },
    players,
    flashes: {},
  };
  return syncYou(state, state);
}

export function netWorth(state) {
  const { cash, holdings } = state.portfolio;
  return cash + Object.entries(holdings).reduce((s, [t, h]) => s + h.shares * lastPoint(state.artists[t]).price, 0);
}

function syncYou(state, prevState) {
  const value = netWorth(state);
  const prevValue = netWorth(prevState === state ? { ...state, artists: priorDayArtists(state.artists) } : prevState);
  return { ...state, players: state.players.map((p) => (p.kind === 'you' ? { ...p, value, prevValue } : p)) };
}

function priorDayArtists(artists) {
  const out = {};
  for (const [t, a] of Object.entries(artists)) out[t] = { ...a, history: a.history.slice(0, -1) };
  return out;
}

export function advanceDay(state) {
  const day = state.day + 1;
  const artists = {};
  const flashes = {};
  const newEvents = [];
  for (const [t, a] of Object.entries(state.artists)) {
    const prev = lastPoint(a);
    const { point, event } = stepArtist(a, prev, day, 0.07);
    artists[t] = { ...a, history: [...a.history, point] };
    flashes[t] = point.price >= prev.price ? 'up' : 'down';
    if (event) newEvents.push(event);
  }
  const players = state.players.map((p) => (p.kind === 'you' ? p : stepPlayer(p)));
  const next = { ...state, day, artists, flashes, players, events: [...newEvents, ...state.events].slice(0, 60) };
  return { state: syncYou(next, state), newEvents };
}

// Trade preview: everything the order ticket shows, plus whether the order is allowed.
export function previewTrade(state, side, ticker, qtyArg) {
  const a = state.artists[ticker];
  if (!a) return { ok: false, error: `UNKNOWN TICKER ${ticker}` };
  const price = lastPoint(a).price;
  const pos = state.portfolio.holdings[ticker] ?? { shares: 0, avgCost: 0 };
  const nw = netWorth(state);
  const cash = state.portfolio.cash;

  let qty;
  if (qtyArg === 'ALL') qty = side === 'SELL' ? pos.shares : maxBuy(state, ticker);
  else if (qtyArg === 'MAX') qty = side === 'SELL' ? pos.shares : maxBuy(state, ticker);
  else qty = Math.floor(Number(qtyArg));

  const base = { ticker, side, price, qty, sharesBefore: pos.shares, weightBefore: (pos.shares * price) / nw };
  if (!Number.isFinite(qty) || qty <= 0) return { ...base, ok: false, error: 'QUANTITY MUST BE > 0' };

  const notional = qty * price;
  const fee = notional * FEE_RATE;
  if (side === 'BUY') {
    const total = notional + fee;
    const nwAfter = nw - fee;
    const sharesAfter = pos.shares + qty;
    const weightAfter = (sharesAfter * price) / nwAfter;
    const out = { ...base, notional, fee, total, cashAfter: cash - total, sharesAfter, weightAfter };
    if (total > cash) return { ...out, ok: false, error: 'INSUFFICIENT CREDITS' };
    if (weightAfter > POSITION_CAP) return { ...out, ok: false, error: `EXCEEDS ${POSITION_CAP * 100}% POSITION CAP` };
    return { ...out, ok: true };
  }
  const total = notional - fee;
  const sharesAfter = pos.shares - qty;
  const out = { ...base, notional, fee, total, cashAfter: cash + total, sharesAfter, weightAfter: (sharesAfter * price) / (nw - fee) };
  if (qty > pos.shares) return { ...out, ok: false, error: `ONLY ${pos.shares} SHS HELD` };
  return { ...out, ok: true };
}

export function maxBuy(state, ticker) {
  const price = lastPoint(state.artists[ticker]).price;
  const pos = state.portfolio.holdings[ticker]?.shares ?? 0;
  const nw = netWorth(state);
  const byCash = state.portfolio.cash / (price * (1 + FEE_RATE));
  const byCap = (POSITION_CAP * nw - pos * price) / (price * (1 + POSITION_CAP * FEE_RATE));
  return Math.max(0, Math.floor(Math.min(byCash, byCap)));
}

export function executeTrade(state, side, ticker, qtyArg) {
  const p = previewTrade(state, side, ticker, qtyArg);
  if (!p.ok) return { ok: false, state, message: `REJECTED: ${p.error}` };
  const holdings = { ...state.portfolio.holdings };
  const pos = holdings[ticker] ?? { shares: 0, avgCost: 0 };
  if (side === 'BUY') {
    holdings[ticker] = { shares: p.sharesAfter, avgCost: (pos.shares * pos.avgCost + p.qty * p.price) / p.sharesAfter };
  } else if (p.sharesAfter === 0) {
    delete holdings[ticker];
  } else {
    holdings[ticker] = { ...pos, shares: p.sharesAfter };
  }
  const tx = { day: state.day, side, ticker, shares: p.qty, price: p.price, fee: p.fee };
  const next = {
    ...state,
    portfolio: { cash: p.cashAfter, holdings, transactions: [tx, ...state.portfolio.transactions] },
  };
  const synced = { ...next, players: next.players.map((pl) => (pl.kind === 'you' ? { ...pl, value: netWorth(next) } : pl)) };
  return {
    ok: true,
    state: synced,
    message: `FILLED: ${side} ${p.qty} ${ticker} @ ${p.price.toFixed(2)} · FEE ${p.fee.toFixed(2)} CR`,
  };
}

// Stand-in for the GPR forecasts table (7-day mean with 90% bounds).
// Real values will come from the Python service via the API.
export function forecast(a, horizon = 7) {
  const h = a.history;
  const n = Math.min(14, h.length - 1);
  const rets = [];
  for (let i = h.length - n; i < h.length; i++) rets.push(Math.log(h[i].price / h[i - 1].price));
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const sd = Math.max(0.01, Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length));
  const mu = mean * 0.5; // shrink toward zero, like a GP reverting to its prior mean
  const last = lastPoint(a);
  const points = [];
  for (let k = 0; k <= horizon; k++) {
    const band = 1.645 * sd * Math.sqrt(k);
    points.push({
      day: last.day + k,
      date: dayToDate(last.day + k),
      mean: last.price * Math.exp(mu * k),
      lower: last.price * Math.exp(mu * k - band),
      upper: last.price * Math.exp(mu * k + band),
    });
  }
  const end = points[points.length - 1];
  const expRet = end.mean / last.price - 1;
  const uncertainty = (end.upper - end.lower) / 2 / last.price;
  const score = expRet / uncertainty;
  const signal = score > 0.2 ? 'BUY' : score < -0.2 ? 'SELL' : 'HOLD';
  return { points, expRet, uncertainty, score, signal };
}
