import { useEffect, useMemo, useRef, useState } from 'react';
import Panel from './components/Panel.jsx';
import TopBar, { Brand } from './components/TopBar.jsx';
import FKeyBar from './components/FKeyBar.jsx';
import TickerTape from './components/TickerTape.jsx';
import MarketTable from './components/MarketTable.jsx';
import PriceChart, { CHART_RANGES } from './components/PriceChart.jsx';
import TradeTicket from './components/TradeTicket.jsx';
import ForecastPanel from './components/ForecastPanel.jsx';
import Portfolio from './components/Portfolio.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import NewsFeed from './components/NewsFeed.jsx';
import Tour from './components/Tour.jsx';
import DayRecap, { buildRecap } from './components/DayRecap.jsx';
import { useTerminal } from './useTerminal.js';
import { maxBuy } from './trading.js';
import { arrow, compact, num, pct, signed, tone } from './format.js';

const FILTERS = ['ALL', 'RISING', 'FALLING', 'YOURS', 'MODEL LIKES'];
// Between these widths the leaderboard and news move into the portfolio panel as tabs (see styles.css).
const MID_SCREEN = '(min-width: 1101px) and (max-width: 1600px)';

function useMedia(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}
const TOUR_KEY = 'earlysignal.seenTour';

const seenTour = () => {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return false;
  }
};

// Server error messages, reworded for people who don't trade.
function friendlyError(msg) {
  let m = /Insufficient credits: need ([\d.]+), have ([\d.]+)/i.exec(msg);
  if (m) return `Not enough cash: that costs ${num(+m[1])} and you have ${num(+m[2])}.`;
  m = /Position limit.*?about (\d+) more (\w+)/i.exec(msg);
  if (m) return `Too much in one artist (30% limit). You can buy about ${m[1]} more ${m[2]}.`;
  if (/Position limit/i.test(msg)) return 'Too much in one artist: the limit is 30% of your money.';
  return msg;
}

export default function Terminal({ api, user, onLogout, onUseMock }) {
  const { market, account, error, refresh, trade, advance } = useTerminal(api, user);
  const [selected, setSelected] = useState('NETT');
  const [side, setSide] = useState('BUY');
  const [qty, setQty] = useState(10);
  const [showCone, setShowCone] = useState(true);
  const [range, setRange] = useState('ALL');
  const [filter, setFilter] = useState('ALL');
  const [portTab, setPortTab] = useState('HOLDINGS');
  const [tour, setTour] = useState(() => (seenTour() ? null : 'first'));
  const [recap, setRecap] = useState(null);
  const [nudge, setNudge] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [focus, setFocus] = useState(null);
  const [busy, setBusy] = useState(null); // 'trade' | 'advance'
  const [status, setStatus] = useState({ text: `Welcome, ${user.username}. Pick an artist on the left to get started.`, kind: 'info' });
  const midScreen = useMedia(MID_SCREEN);
  const cmdRef = useRef(null);
  const qtyRef = useRef(null);
  const timers = useRef({});

  // The stored player no longer exists (e.g. after /api/admin/reset): back to the login screen.
  useEffect(() => {
    if (error?.status === 404 && /user/i.test(error.message)) onLogout();
  }, [error, onLogout]);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  const later = (name, ms, fn) => {
    clearTimeout(timers.current[name]);
    timers.current[name] = setTimeout(fn, ms);
  };

  const rows = useMemo(() => {
    if (!market) return [];
    const all = Object.values(market.artists);
    switch (filter) {
      case 'RISING':
        return all.filter((a) => a.changePct > 0).sort((a, b) => b.changePct - a.changePct);
      case 'FALLING':
        return all.filter((a) => a.changePct < 0).sort((a, b) => a.changePct - b.changePct);
      case 'YOURS':
        return all.filter((a) => account?.holdings[a.ticker]);
      case 'MODEL LIKES':
        return all.filter((a) => a.fc?.signal === 'BUY').sort((a, b) => b.fc.score - a.fc.score);
      default:
        return all;
    }
  }, [market, account, filter]);

  const ready = market && account;
  const artist = ready ? (market.artists[selected] ?? Object.values(market.artists)[0]) : null;
  const ticker = artist?.ticker;

  const flashPanel = (area) => {
    setFocus(area);
    later('focus', 1200, () => setFocus(null));
  };

  const closeTour = () => {
    if (tour === 'first') {
      try {
        localStorage.setItem(TOUR_KEY, '1');
      } catch {
        // Storage blocked: the tour just shows again next time.
      }
    }
    setTour(null);
  };

  const doTrade = async (sd, t, shares) => {
    if (busy) return;
    setBusy('trade');
    setRecap(null);
    try {
      const { result: r } = await trade(sd, t, shares);
      const verb = r.side === 'BUY' ? 'Bought' : 'Sold';
      const text = `✓ ${verb} ${r.shares} ${r.ticker} for ${num(r.price * r.shares)} CR (fee ${num(r.fee)})`;
      setFeedback({ kind: 'done', text, key: Date.now() });
      setStatus({ text, kind: 'ok' });
      setHighlight({ ticker: r.ticker, key: Date.now() });
      setPortTab('HOLDINGS');
      flashPanel('area-port');
      later('feedback', 5000, () => setFeedback(null));
    } catch (e) {
      const text = `✕ ${friendlyError(e.message)}`;
      setFeedback({ kind: 'fail', text, key: Date.now() });
      setStatus({ text, kind: 'err' });
      later('feedback', 6000, () => setFeedback(null));
    } finally {
      setBusy(null);
    }
  };

  const doAdvance = async () => {
    if (busy || !ready) return;
    // The day summary has to be closed before moving on, so nobody skips past what just happened.
    if (recap) {
      setNudge((n) => n + 1);
      setStatus({ text: 'Close the day summary first (CONTINUE or ESC), then advance again.', kind: 'err' });
      return;
    }
    setBusy('advance');
    const before = { market, account };
    try {
      const { result, after } = await advance();
      if (after) setRecap(buildRecap(before, after, result));
      const n = result?.events?.length ?? 0;
      setStatus({ text: `Day ${result.day ?? ''} · ${n} news ${n === 1 ? 'story' : 'stories'} · prices updated`, kind: 'info' });
    } catch (e) {
      setStatus({ text: `Couldn't advance the day: ${e.message}`, kind: 'err' });
    } finally {
      setBusy(null);
    }
  };

  const select = (t) => {
    setSelected(t);
    setFeedback(null);
  };

  const runCommand = (raw) => {
    if (!ready) return;
    const [verb, arg1, arg2] = raw.toUpperCase().split(/\s+/);
    if (verb === 'HELP' || verb === '?') return setTour('help');
    if (verb === 'NEXT' || verb === 'ADV' || verb === 'ADVANCE') return doAdvance();
    if (verb === 'BUY' || verb === 'SELL') {
      const a = market.artists[arg1];
      if (!a) return setStatus({ text: `There's no artist called "${arg1 ?? ''}". Try one from the list, like NETT.`, kind: 'err' });
      setSelected(arg1);
      setSide(verb);
      const held = account.holdings[arg1]?.shares ?? 0;
      let shares = Number(arg2 ?? 1);
      if (arg2 === 'ALL' || arg2 === 'MAX') {
        shares = verb === 'SELL' ? held : maxBuy({ price: a.price, cash: account.cash, totalValue: account.totalValue, sharesHeld: held });
      }
      if (!Number.isInteger(shares) || shares <= 0) {
        const text = verb === 'SELL' && held === 0 ? `You don't own any ${arg1}.` : 'Use a whole number of shares, like BUY NETT 10.';
        return setStatus({ text, kind: 'err' });
      }
      setQty(shares);
      return doTrade(verb, arg1, shares);
    }
    if (verb === 'FCST') {
      const t = arg1 ?? ticker;
      if (!market.artists[t]) return setStatus({ text: `There's no artist called "${t}".`, kind: 'err' });
      setSelected(t);
      setShowCone(true);
      return flashPanel('area-fcst');
    }
    if (verb === 'R' || verb === 'REFRESH') return refresh();
    if (market.artists[verb]) return select(verb);
    setStatus({ text: `Didn't recognize "${raw}". Try BUY NETT 10, SELL NETT ALL, NEXT, or HELP.`, kind: 'err' });
  };

  const fkey = (action) => {
    if (action === 'help') setTour((g) => (g ? null : 'help'));
    if (action === 'buy' || action === 'sell') {
      setSide(action.toUpperCase());
      flashPanel('area-trade');
      qtyRef.current?.focus();
      qtyRef.current?.select();
    }
    if (action === 'fcst') setShowCone((c) => !c);
    if (action === 'advance') doAdvance();
    if (action === 'cmd') cmdRef.current?.focus();
  };

  // Keyboard shortcuts. A ref keeps the listener reading the latest state.
  const keyHandler = useRef(null);
  keyHandler.current = (e) => {
    const map = { F1: 'help', F2: 'buy', F3: 'sell', F4: 'fcst', F8: 'advance' };
    if (map[e.key]) {
      e.preventDefault();
      if (tour && map[e.key] !== 'help') return;
      return fkey(map[e.key]);
    }
    if (e.key === 'Escape') {
      if (tour) closeTour();
      setRecap(null);
      document.activeElement?.blur();
      return;
    }
    if (tour || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (e.key === '/') {
      e.preventDefault();
      cmdRef.current?.focus();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = rows.findIndex((a) => a.ticker === ticker);
      const next = rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];
      if (next) select(next.ticker);
    }
  };
  useEffect(() => {
    const h = (e) => keyHandler.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (!ready) {
    return (
      <div className="screen">
        <div className="login">
          <Brand />
          {error ? (
            <>
              <div className="login-err">{error.network ? "Can't reach the game server." : error.message}</div>
              <p className="login-sub">
                {error.network ? 'Start the backend (cd backend && ./mvnw spring-boot:run), then try again.' : 'The server returned an error.'}
              </p>
              <div className="screen-actions">
                <button className="go" onClick={refresh}>TRY AGAIN</button>
                {api.source !== 'mock' && <button className="link" onClick={onUseMock}>Play with practice data instead</button>}
              </div>
            </>
          ) : (
            <p className="login-sub blink">Loading the market…</p>
          )}
        </div>
      </div>
    );
  }

  const holding = account.holdings[ticker];
  const ranked = market.leaderboard;
  const you = ranked.find((p) => p.kind === 'you');
  const gpr = ranked.find((p) => p.kind === 'ai');
  const prices = artist.history.map((p) => p.price);
  const portTabs = midScreen ? ['HOLDINGS', 'HISTORY', 'LEADERBOARD', 'NEWS'] : ['HOLDINGS', 'HISTORY'];
  const shownTab = portTabs.includes(portTab) ? portTab : 'HOLDINGS';

  return (
    <div className="terminal">
      <TopBar
        cmdRef={cmdRef}
        onCommand={runCommand}
        source={api.source}
        online={!error}
        username={user.username}
        day={market.day}
        gameDate={market.gameDate}
        cash={account.cash}
        worth={account.totalValue}
        busy={busy === 'advance'}
        blocked={!!recap}
        onAdvance={doAdvance}
        onLogout={onLogout}
      />
      <FKeyBar onAction={fkey} />
      <TickerTape artists={market.artists} onSelect={select} />

      <main className="workspace">
        <Panel area="area-market" title="ARTISTS" hint="Click one to see it" tabs={FILTERS} activeTab={filter} onTab={setFilter}>
          {rows.length ? (
            <MarketTable
              rows={rows}
              version={market.version}
              flashes={market.flashes}
              selected={ticker}
              held={account.holdings}
              onSelect={select}
            />
          ) : (
            <div className="empty">
              <span>{filter === 'YOURS' ? "You don't own any artists yet." : 'Nothing here right now.'}</span>
            </div>
          )}
        </Panel>

        <Panel
          area="area-chart"
          title={`${ticker} · PRICE`}
          hint={artist.genre}
          right={
            <button className="link" onClick={() => setShowCone((c) => !c)}>
              {showCone ? 'Hide forecast (F4)' : 'Show forecast (F4)'}
            </button>
          }
          tabs={CHART_RANGES}
          activeTab={range}
          onTab={setRange}
        >
          <div className="quote-strip">
            <div className="qs-main">
              <span className="qs-tkr">{ticker}</span>
              <span className="qs-name">{artist.name}</span>
            </div>
            <div className="qs-px">
              <b>{num(artist.price)}</b>
              <span className={tone(artist.changePct)}>
                {arrow(artist.changePct)} {signed(artist.change)} ({pct(artist.changePct)}) today
              </span>
            </div>
            <div className="qs-stats">
              <span>LISTENERS <b>{compact(artist.listeners)}</b> <em className={tone(artist.listenersChangePct)}>{pct(artist.listenersChangePct, 1)}</em></span>
              <span>MONTH HIGH <b>{num(Math.max(...prices))}</b></span>
              <span>MONTH LOW <b>{num(Math.min(...prices))}</b></span>
              <span>YOU OWN <b>{holding ? `${holding.shares} shares` : 'none'}</b></span>
            </div>
          </div>
          <PriceChart artist={artist} showCone={showCone} range={range} avgCost={holding?.avgCost} events={market.events} trades={account.transactions} />
          <div className="legend">
            <span><i className="lg-price" /> Price</span>
            {artist.forecast.length > 0 && <span><i className="lg-cone" /> Forecast: likely range for the next 7 days</span>}
            {holding && <span><i className="lg-cost" /> What you paid</span>}
            {account.transactions.some((t) => t.ticker === ticker) && <span><i className="lg-trade" /> Your trades</span>}
            <span className="note">▲▼ news · bars = listeners</span>
          </div>
        </Panel>

        <Panel area={`area-trade ${focus === 'area-trade' ? 'focus' : ''}`} title="BUY / SELL" hint={artist.name}>
          <TradeTicket
            artist={artist}
            account={account}
            side={side}
            setSide={setSide}
            qty={qty}
            setQty={setQty}
            qtyRef={qtyRef}
            busy={busy === 'trade'}
            feedback={feedback}
            onExecute={doTrade}
          />
        </Panel>

        <Panel area={`area-fcst ${focus === 'area-fcst' ? 'focus' : ''}`} title="FORECAST" hint="Model's 7-day guess">
          <ForecastPanel artist={artist} />
        </Panel>

        <Panel
          area={`area-port ${focus === 'area-port' ? 'focus' : ''}`}
          title="YOUR PORTFOLIO"
          right={you ? `Rank #${you.rank} of ${ranked.length}` : ''}
          tabs={portTabs}
          activeTab={shownTab}
          onTab={setPortTab}
        >
          {shownTab === 'LEADERBOARD' ? (
            <Leaderboard players={ranked} />
          ) : shownTab === 'NEWS' ? (
            <NewsFeed events={market.events} day={market.day} onSelect={select} />
          ) : (
            <Portfolio account={account} tab={shownTab} highlight={highlight} onSelect={select} />
          )}
        </Panel>

        <Panel
          area="area-lead"
          title="LEADERBOARD"
          right={gpr ? `AI bot is #${gpr.rank}` : `${ranked.length} players`}
        >
          <Leaderboard players={ranked} />
        </Panel>

        <Panel area="area-news" title="NEWS" hint="Events that move prices">
          <NewsFeed events={market.events} day={market.day} onSelect={select} />
        </Panel>
      </main>

      <footer className="statusbar">
        <span className={`status status-${error ? 'err' : status.kind}`}>
          {error ? `Lost connection to the game server (${error.message}). Showing the last data and retrying…` : status.text}
        </span>
        <span className="hints">Press F1 any time for how to play</span>
      </footer>

      {recap && <DayRecap recap={recap} nudge={nudge} onClose={() => setRecap(null)} onSelect={select} />}
      {tour && <Tour firstTime={tour === 'first'} onClose={closeTour} />}
    </div>
  );
}
