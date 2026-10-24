import { useEffect, useMemo, useRef, useState } from 'react';
import Panel from './components/Panel.jsx';
import TopBar, { Brand } from './components/TopBar.jsx';
import FKeyBar from './components/FKeyBar.jsx';
import TickerTape from './components/TickerTape.jsx';
import MarketTable, { TIER_LABEL } from './components/MarketTable.jsx';
import PriceChart from './components/PriceChart.jsx';
import TradeTicket from './components/TradeTicket.jsx';
import ForecastPanel from './components/ForecastPanel.jsx';
import Portfolio from './components/Portfolio.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import NewsFeed from './components/NewsFeed.jsx';
import HelpOverlay from './components/HelpOverlay.jsx';
import { useTerminal } from './useTerminal.js';
import { maxBuy } from './trading.js';
import { arrow, compact, num, pct, signed, tone } from './format.js';

const FILTERS = ['ALL', 'GAINERS', 'LOSERS', 'HELD', 'FCST BUY'];
const RANGES = ['1W', '2W', '1M', 'ALL'];

export default function Terminal({ api, user, onLogout, onUseMock }) {
  const { market, account, error, refresh, trade, advance } = useTerminal(api, user);
  const [selected, setSelected] = useState('LUNA');
  const [side, setSide] = useState('BUY');
  const [qty, setQty] = useState(10);
  const [showCone, setShowCone] = useState(true);
  const [range, setRange] = useState('ALL');
  const [filter, setFilter] = useState('ALL');
  const [portTab, setPortTab] = useState('HOLDINGS');
  const [help, setHelp] = useState(false);
  const [focus, setFocus] = useState(null);
  const [busy, setBusy] = useState(null); // 'trade' | 'advance'
  const [status, setStatus] = useState({ text: `WELCOME ${user.username.toUpperCase()} · TYPE HELP <GO> OR PRESS F1`, kind: 'info' });
  const cmdRef = useRef(null);
  const qtyRef = useRef(null);

  // The stored player no longer exists (e.g. after /api/admin/reset): back to the login screen.
  useEffect(() => {
    if (error?.status === 404 && /user/i.test(error.message)) onLogout();
  }, [error, onLogout]);

  const rows = useMemo(() => {
    if (!market) return [];
    const all = Object.values(market.artists);
    switch (filter) {
      case 'GAINERS':
        return all.filter((a) => a.changePct > 0).sort((a, b) => b.changePct - a.changePct);
      case 'LOSERS':
        return all.filter((a) => a.changePct < 0).sort((a, b) => a.changePct - b.changePct);
      case 'HELD':
        return all.filter((a) => account?.holdings[a.ticker]);
      case 'FCST BUY':
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
    setTimeout(() => setFocus(null), 900);
  };

  const doTrade = async (sd, t, shares) => {
    if (busy) return;
    setBusy('trade');
    try {
      const r = await trade(sd, t, shares);
      setStatus({ text: `FILLED: ${r.side} ${r.shares} ${r.ticker} @ ${num(r.price)} · FEE ${num(r.fee)} CR`, kind: 'ok' });
    } catch (e) {
      setStatus({ text: `REJECTED: ${e.message.toUpperCase()}`, kind: 'err' });
    } finally {
      setBusy(null);
    }
  };

  const doAdvance = async () => {
    if (busy) return;
    setBusy('advance');
    try {
      const r = await advance();
      const first = r?.events?.[0];
      const headline = first ? ` · ${first.type} ${first.ticker} ${pct(first.impactPct, 1)}` : '';
      setStatus({ text: `ADVANCED TO ${r.gameDate} · ${r.events.length} EVENT(S)${headline}`, kind: 'info' });
    } catch (e) {
      setStatus({ text: `ADVANCE DAY FAILED: ${e.message.toUpperCase()}`, kind: 'err' });
    } finally {
      setBusy(null);
    }
  };

  const select = (t) => {
    setSelected(t);
    setStatus({ text: `${t} <ARTIST> LOADED`, kind: 'info' });
  };

  const runCommand = (raw) => {
    if (!ready) return;
    const [verb, arg1, arg2] = raw.toUpperCase().split(/\s+/);
    if (verb === 'HELP' || verb === '?') return setHelp(true);
    if (verb === 'NEXT' || verb === 'ADV' || verb === 'ADVANCE') return doAdvance();
    if (verb === 'BUY' || verb === 'SELL') {
      const a = market.artists[arg1];
      if (!a) return setStatus({ text: `UNKNOWN TICKER ${arg1 ?? ''}`, kind: 'err' });
      setSelected(arg1);
      setSide(verb);
      const held = account.holdings[arg1]?.shares ?? 0;
      let shares = Number(arg2 ?? 1);
      if (arg2 === 'ALL' || arg2 === 'MAX') {
        shares = verb === 'SELL' ? held : maxBuy({ price: a.price, cash: account.cash, totalValue: account.totalValue, sharesHeld: held });
      }
      if (!Number.isInteger(shares) || shares <= 0) {
        return setStatus({ text: `REJECTED: ${verb === 'SELL' && held === 0 ? `NO ${arg1} SHARES HELD` : 'QUANTITY MUST BE A WHOLE NUMBER > 0'}`, kind: 'err' });
      }
      return doTrade(verb, arg1, shares);
    }
    if (verb === 'FCST') {
      const t = arg1 ?? ticker;
      const a = market.artists[t];
      if (!a) return setStatus({ text: `UNKNOWN TICKER ${t}`, kind: 'err' });
      setSelected(t);
      setShowCone(true);
      return setStatus({
        text: a.fc ? `FCST ${t} · ${a.fc.points.length}D ${pct(a.fc.expRet * 100)} · SIGNAL ${a.fc.signal}` : `FCST ${t} · NO FORECAST FROM MODEL YET`,
        kind: a.fc ? 'info' : 'err',
      });
    }
    if (verb === 'R' || verb === 'REFRESH') return refresh();
    if (market.artists[verb]) return select(verb);
    setStatus({ text: `UNKNOWN COMMAND: ${raw.toUpperCase()}`, kind: 'err' });
  };

  const fkey = (action) => {
    if (action === 'help') setHelp((h) => !h);
    if (action === 'buy' || action === 'sell') {
      setSide(action.toUpperCase());
      qtyRef.current?.focus();
      qtyRef.current?.select();
    }
    if (action === 'fcst') setShowCone((c) => !c);
    if (action === 'port') {
      setPortTab((t) => (t === 'HOLDINGS' ? 'HISTORY' : 'HOLDINGS'));
      flashPanel('area-port');
    }
    if (action === 'leaders') flashPanel('area-lead');
    if (action === 'advance') doAdvance();
  };

  // Keyboard shortcuts. A ref keeps the listener reading the latest state.
  const keyHandler = useRef(null);
  keyHandler.current = (e) => {
    const map = { F1: 'help', F2: 'buy', F3: 'sell', F4: 'fcst', F6: 'port', F7: 'leaders', F8: 'advance' };
    if (map[e.key]) {
      e.preventDefault();
      return fkey(map[e.key]);
    }
    if (e.key === 'Escape') {
      setHelp(false);
      document.activeElement?.blur();
      return;
    }
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (e.key === '/') {
      e.preventDefault();
      cmdRef.current?.focus();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = rows.findIndex((a) => a.ticker === ticker);
      const next = rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];
      if (next) setSelected(next.ticker);
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
              <div className="login-err">{error.network ? 'CANNOT REACH THE EARLYSIGNAL API' : error.message.toUpperCase()}</div>
              <p className="login-sub">
                {error.network ? 'Start the backend (cd backend && ./mvnw spring-boot:run), then retry.' : 'The API returned an error.'}
              </p>
              <div className="screen-actions">
                <button className="go" onClick={refresh}>RETRY</button>
                {api.source !== 'mock' && <button className="link" onClick={onUseMock}>Use mock data instead</button>}
              </div>
            </>
          ) : (
            <p className="login-sub blink">LOADING MARKET DATA…</p>
          )}
        </div>
      </div>
    );
  }

  const holding = account.holdings[ticker];
  const ranked = market.leaderboard;
  const you = ranked.find((p) => p.kind === 'you');
  const gpr = ranked.find((p) => p.kind === 'ai');
  const worthChangePct = you?.prevValue ? ((you.totalValue - you.prevValue) / you.prevValue) * 100 : 0;
  const prices = artist.history.map((p) => p.price);

  return (
    <div className="terminal">
      <TopBar
        cmdRef={cmdRef}
        onCommand={runCommand}
        source={api.source}
        online={!error}
        username={user.username}
        dayNumber={market.dayNumber}
        gameDate={market.gameDate}
        cash={account.cash}
        worth={account.totalValue}
        worthChangePct={worthChangePct}
        busy={busy === 'advance'}
        onAdvance={doAdvance}
        onLogout={onLogout}
      />
      <FKeyBar onAction={fkey} selected={ticker} />
      <TickerTape artists={market.artists} onSelect={select} />

      <main className="workspace">
        <Panel
          area="area-market"
          code="MKT"
          title="ARTIST MONITOR"
          right={`${rows.length} SECURITIES`}
          tabs={FILTERS}
          activeTab={filter}
          onTab={setFilter}
        >
          <MarketTable
            rows={rows}
            version={market.version}
            flashes={market.flashes}
            selected={ticker}
            held={account.holdings}
            onSelect={select}
          />
        </Panel>

        <Panel
          area="area-chart"
          code="GP"
          title={`${ticker} <ARTIST> · PRICE & LISTENERS`}
          right={showCone ? 'FCST CONE ON · F4' : 'FCST CONE OFF · F4'}
          tabs={RANGES}
          activeTab={range}
          onTab={setRange}
        >
          <div className="quote-strip">
            <div className="qs-main">
              <span className="qs-tkr">{ticker}</span>
              <span className="qs-name">{artist.name}</span>
              <span className="qs-genre">{TIER_LABEL[artist.tier] ?? artist.tier}</span>
            </div>
            <div className="qs-px">
              <b>{num(artist.price)}</b>
              <span className={tone(artist.changePct)}>
                {arrow(artist.changePct)} {signed(artist.change)} ({pct(artist.changePct)})
              </span>
            </div>
            <div className="qs-stats">
              <span>LSTNR <b>{compact(artist.listeners)}</b> <em className={tone(artist.listenersChangePct)}>{pct(artist.listenersChangePct, 1)}</em></span>
              <span>30D HI <b className="up">{num(Math.max(...prices))}</b></span>
              <span>30D LO <b className="down">{num(Math.min(...prices))}</b></span>
              <span>HELD <b>{holding ? `${holding.shares} @ ${num(holding.avgCost)}` : '—'}</b></span>
            </div>
          </div>
          <PriceChart artist={artist} showCone={showCone} range={range} avgCost={holding?.avgCost} events={market.events} />
          <div className="legend">
            <span><i className="lg-price" /> PRICE</span>
            <span><i className="lg-mean" /> GPR MEAN</span>
            <span><i className="lg-cone" /> 90% CONE</span>
            <span><i className="lg-cost" /> AVG COST</span>
            <span className="muted">{artist.forecast.length ? 'BARS = MONTHLY LISTENERS' : 'NO FORECAST YET · BARS = MONTHLY LISTENERS'}</span>
          </div>
        </Panel>

        <Panel area="area-trade" code="ORD" title="ORDER TICKET" right="FEE 1% · CAP 30%">
          <TradeTicket
            artist={artist}
            account={account}
            side={side}
            setSide={setSide}
            qty={qty}
            setQty={setQty}
            qtyRef={qtyRef}
            busy={busy === 'trade'}
            onExecute={doTrade}
          />
        </Panel>

        <Panel area="area-fcst" code="FCST" title={`${ticker} GPR FORECAST`} right="MODEL · GPR">
          <ForecastPanel fc={artist.fc} price={artist.price} />
        </Panel>

        <Panel
          area={`area-port ${focus === 'area-port' ? 'focus' : ''}`}
          code="PORT"
          title="PORTFOLIO"
          right={you ? `RANK ${you.rank}/${ranked.length}` : ''}
          tabs={['HOLDINGS', 'HISTORY']}
          activeTab={portTab}
          onTab={setPortTab}
        >
          <Portfolio account={account} tab={portTab} onSelect={select} />
        </Panel>

        <Panel
          area={`area-lead ${focus === 'area-lead' ? 'focus' : ''}`}
          code="LDR"
          title="LEADERBOARD"
          right={gpr ? `AI BOT #${gpr.rank} · ${num(gpr.totalValue, 0)}` : `${ranked.length} PLAYERS`}
        >
          <Leaderboard players={ranked} />
        </Panel>

        <Panel area="area-news" code="NEWS" title="EVENT WIRE" right={`${market.events.length} ITEMS`}>
          <NewsFeed events={market.events} gameDate={market.gameDate} onSelect={select} />
        </Panel>
      </main>

      <footer className="statusbar">
        <span className={`status status-${error ? 'err' : status.kind}`}>
          {error ? `API ERROR: ${error.message.toUpperCase()} · SHOWING LAST DATA · RETRYING` : status.text}
        </span>
        <span className="hints">/ CMD · ↑↓ ARTIST · F2 BUY · F3 SELL · F4 FCST · F8 ADV DAY · F1 HELP</span>
      </footer>

      {help && <HelpOverlay onClose={() => setHelp(false)} />}
    </div>
  );
}
