import { useEffect, useMemo, useRef, useState } from 'react';
import Panel from './components/Panel.jsx';
import TopBar from './components/TopBar.jsx';
import FKeyBar from './components/FKeyBar.jsx';
import TickerTape from './components/TickerTape.jsx';
import MarketTable from './components/MarketTable.jsx';
import PriceChart from './components/PriceChart.jsx';
import TradeTicket from './components/TradeTicket.jsx';
import ForecastPanel from './components/ForecastPanel.jsx';
import Portfolio from './components/Portfolio.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import NewsFeed from './components/NewsFeed.jsx';
import HelpOverlay from './components/HelpOverlay.jsx';
import { advanceDay, createInitialState, executeTrade, forecast, netWorth, quote } from './mock/engine.js';
import { arrow, compact, num, pct, signed, tone } from './format.js';

const FILTERS = ['ALL', 'GAINERS', 'LOSERS', 'HELD', 'FCST BUY'];
const RANGES = ['1W', '2W', '1M', 'ALL'];

export default function App() {
  const [game, setGame] = useState(createInitialState);
  const [selected, setSelected] = useState('LUNA');
  const [side, setSide] = useState('BUY');
  const [qty, setQty] = useState(10);
  const [showCone, setShowCone] = useState(true);
  const [range, setRange] = useState('ALL');
  const [filter, setFilter] = useState('ALL');
  const [portTab, setPortTab] = useState('HOLDINGS');
  const [help, setHelp] = useState(false);
  const [focus, setFocus] = useState(null);
  const [status, setStatus] = useState({ text: 'READY · TYPE HELP <GO> OR PRESS F1', kind: 'info' });
  const cmdRef = useRef(null);
  const qtyRef = useRef(null);

  const artist = game.artists[selected];
  const q = quote(artist);
  const fc = useMemo(() => forecast(artist), [artist]);
  const holding = game.portfolio.holdings[selected];
  const you = game.players.find((p) => p.kind === 'you');
  const worth = netWorth(game);

  const rows = useMemo(() => {
    const all = Object.values(game.artists);
    const chg = (a) => quote(a).changePct;
    switch (filter) {
      case 'GAINERS':
        return all.filter((a) => chg(a) > 0).sort((a, b) => chg(b) - chg(a));
      case 'LOSERS':
        return all.filter((a) => chg(a) < 0).sort((a, b) => chg(a) - chg(b));
      case 'HELD':
        return all.filter((a) => game.portfolio.holdings[a.ticker]);
      case 'FCST BUY':
        return all.filter((a) => forecast(a).signal === 'BUY').sort((a, b) => forecast(b).score - forecast(a).score);
      default:
        return all;
    }
  }, [game, filter]);

  const flashPanel = (area) => {
    setFocus(area);
    setTimeout(() => setFocus(null), 900);
  };

  const trade = (sd, ticker, amount) => {
    const r = executeTrade(game, sd, ticker, amount);
    if (r.ok) setGame(r.state);
    setStatus({ text: r.message, kind: r.ok ? 'ok' : 'err' });
  };

  const advance = () => {
    const { state, newEvents } = advanceDay(game);
    setGame(state);
    const headline = newEvents[0] ? ` · ${newEvents[0].type} ${newEvents[0].ticker} ${pct(newEvents[0].impactPct, 1)}` : '';
    setStatus({ text: `DAY ${state.day} OPEN · ${newEvents.length} EVENT(S)${headline}`, kind: 'info' });
  };

  const select = (t) => {
    setSelected(t);
    setStatus({ text: `${t} <ARTIST> LOADED`, kind: 'info' });
  };

  const runCommand = (raw) => {
    const [verb, arg1, arg2] = raw.toUpperCase().split(/\s+/);
    if (verb === 'HELP' || verb === '?') return setHelp(true);
    if (verb === 'NEXT' || verb === 'ADV' || verb === 'ADVANCE') return advance();
    if (verb === 'BUY' || verb === 'SELL') {
      if (!game.artists[arg1]) return setStatus({ text: `UNKNOWN TICKER ${arg1 ?? ''}`, kind: 'err' });
      setSelected(arg1);
      setSide(verb);
      return trade(verb, arg1, arg2 === 'ALL' || arg2 === 'MAX' ? arg2 : Number(arg2 ?? 1));
    }
    if (verb === 'FCST') {
      const t = arg1 ?? selected;
      if (!game.artists[t]) return setStatus({ text: `UNKNOWN TICKER ${t}`, kind: 'err' });
      setSelected(t);
      setShowCone(true);
      const f = forecast(game.artists[t]);
      return setStatus({ text: `FCST ${t} · 7D ${pct(f.expRet * 100)} · SIGNAL ${f.signal}`, kind: 'info' });
    }
    if (game.artists[verb]) return select(verb);
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
    if (action === 'advance') advance();
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
    const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if (typing) return;
    if (e.key === '/') {
      e.preventDefault();
      cmdRef.current?.focus();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = rows.findIndex((a) => a.ticker === selected);
      const next = rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];
      if (next) setSelected(next.ticker);
    }
  };
  useEffect(() => {
    const h = (e) => keyHandler.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const gpr = game.players.find((p) => p.kind === 'ai');
  const ranked = [...game.players].sort((a, b) => b.value - a.value);
  const yourRank = ranked.findIndex((p) => p.kind === 'you') + 1;
  const gprRank = ranked.findIndex((p) => p.kind === 'ai') + 1;

  return (
    <div className="terminal">
      <TopBar
        cmdRef={cmdRef}
        onCommand={runCommand}
        day={game.day}
        cash={game.portfolio.cash}
        worth={worth}
        worthChangePct={((you.value - you.prevValue) / you.prevValue) * 100}
        onAdvance={advance}
      />
      <FKeyBar onAction={fkey} selected={selected} />
      <TickerTape artists={game.artists} onSelect={select} />

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
            day={game.day}
            flashes={game.flashes}
            selected={selected}
            held={game.portfolio.holdings}
            onSelect={select}
          />
        </Panel>

        <Panel
          area="area-chart"
          code="GP"
          title={`${selected} <ARTIST> · PRICE & LISTENERS`}
          right={showCone ? 'FCST CONE ON · F4' : 'FCST CONE OFF · F4'}
          tabs={RANGES}
          activeTab={range}
          onTab={setRange}
        >
          <div className="quote-strip">
            <div className="qs-main">
              <span className="qs-tkr">{selected}</span>
              <span className="qs-name">{artist.name}</span>
              <span className="qs-genre">{artist.genre}</span>
            </div>
            <div className="qs-px">
              <b>{num(q.price)}</b>
              <span className={tone(q.change)}>
                {arrow(q.change)} {signed(q.change)} ({pct(q.changePct)})
              </span>
            </div>
            <div className="qs-stats">
              <span>LSTNR <b>{compact(q.listeners)}</b> <em className={tone(q.listenersChangePct)}>{pct(q.listenersChangePct, 1)}</em></span>
              <span>30D HI <b className="up">{num(Math.max(...artist.history.map((p) => p.price)))}</b></span>
              <span>30D LO <b className="down">{num(Math.min(...artist.history.map((p) => p.price)))}</b></span>
              <span>HELD <b>{holding ? `${holding.shares} @ ${num(holding.avgCost)}` : '—'}</b></span>
            </div>
          </div>
          <PriceChart
            artist={artist}
            fc={fc}
            showCone={showCone}
            range={range}
            avgCost={holding?.avgCost}
            events={game.events}
          />
          <div className="legend">
            <span><i className="lg-price" /> PRICE</span>
            <span><i className="lg-mean" /> GPR MEAN</span>
            <span><i className="lg-cone" /> 90% CONE</span>
            <span><i className="lg-cost" /> AVG COST</span>
            <span className="muted">BARS = MONTHLY LISTENERS</span>
          </div>
        </Panel>

        <Panel area="area-trade" code="ORD" title="ORDER TICKET" right="FEE 1% · CAP 30%">
          <TradeTicket
            game={game}
            ticker={selected}
            side={side}
            setSide={setSide}
            qty={qty}
            setQty={setQty}
            qtyRef={qtyRef}
            onExecute={trade}
          />
        </Panel>

        <Panel area="area-fcst" code="FCST" title={`${selected} GPR 7-DAY FORECAST`} right="MODEL · GPR">
          <ForecastPanel fc={fc} price={q.price} />
        </Panel>

        <Panel
          area={`area-port ${focus === 'area-port' ? 'focus' : ''}`}
          code="PORT"
          title="PORTFOLIO"
          right={`RANK ${yourRank}/${ranked.length}`}
          tabs={['HOLDINGS', 'HISTORY']}
          activeTab={portTab}
          onTab={setPortTab}
        >
          <Portfolio game={game} tab={portTab} onSelect={select} />
        </Panel>

        <Panel
          area={`area-lead ${focus === 'area-lead' ? 'focus' : ''}`}
          code="LDR"
          title="LEADERBOARD"
          right={`ES-GPR #${gprRank} · ${num(gpr.value, 0)}`}
        >
          <Leaderboard players={game.players} />
        </Panel>

        <Panel area="area-news" code="NEWS" title="EVENT WIRE" right={`${game.events.length} ITEMS`}>
          <NewsFeed events={game.events} day={game.day} onSelect={select} />
        </Panel>
      </main>

      <footer className="statusbar">
        <span className={`status status-${status.kind}`}>{status.text}</span>
        <span className="hints">/ CMD · ↑↓ ARTIST · F2 BUY · F3 SELL · F4 FCST · F8 ADV DAY · F1 HELP</span>
      </footer>

      {help && <HelpOverlay onClose={() => setHelp(false)} />}
    </div>
  );
}
