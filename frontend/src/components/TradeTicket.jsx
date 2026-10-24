import { POSITION_CAP, maxBuy, previewTrade } from '../mock/engine.js';
import { num } from '../format.js';

export default function TradeTicket({ game, ticker, side, setSide, qty, setQty, qtyRef, onExecute }) {
  const p = previewTrade(game, side, ticker, qty || 0);
  const held = game.portfolio.holdings[ticker]?.shares ?? 0;
  const max = side === 'BUY' ? maxBuy(game, ticker) : held;
  const capPct = POSITION_CAP * 100;
  const wBefore = (p.weightBefore ?? 0) * 100;
  const wAfter = (p.weightAfter ?? p.weightBefore ?? 0) * 100;

  const submit = (e) => {
    e.preventDefault();
    onExecute(side, ticker, qty);
  };

  return (
    <form className={`ticket side-${side.toLowerCase()}`} onSubmit={submit}>
      <div className="side-toggle">
        {['BUY', 'SELL'].map((sd) => (
          <button type="button" key={sd} className={side === sd ? `on ${sd.toLowerCase()}` : ''} onClick={() => setSide(sd)}>
            {sd}
          </button>
        ))}
      </div>

      <div className="kv">
        <span>SECURITY</span>
        <b className="amber">{ticker}</b>
        <span>LAST</span>
        <b>{num(p.price ?? 0)}</b>
        <span>QTY</span>
        <div className="qty-row">
          <input
            ref={qtyRef}
            type="number"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value === '' ? '' : Math.max(0, Math.floor(+e.target.value)))}
          />
          {[1, 10, 25].map((n) => (
            <button type="button" key={n} onClick={() => setQty(n)}>{n}</button>
          ))}
          <button type="button" onClick={() => setQty(max)}>MAX</button>
        </div>
        <span>NOTIONAL</span>
        <b>{num(p.notional ?? 0)}</b>
        <span>FEE 1%</span>
        <b>{num(p.fee ?? 0)}</b>
        <span>{side === 'BUY' ? 'TOTAL DEBIT' : 'NET CREDIT'}</span>
        <b className="amber">{num(p.total ?? 0)} CR</b>
        <span>CASH AFTER</span>
        <b>{num(p.cashAfter ?? game.portfolio.cash)}</b>
        <span>POSITION</span>
        <b>
          {held} → {p.sharesAfter ?? held} SHS
        </b>
      </div>

      <div className="cap">
        <div className="cap-label">
          <span>WEIGHT {num(wBefore, 1)}% → {num(wAfter, 1)}%</span>
          <span className="muted">CAP {capPct}%</span>
        </div>
        <div className="cap-bar">
          <div className="cap-fill before" style={{ width: `${Math.min(100, (wBefore / 40) * 100)}%` }} />
          <div
            className={`cap-fill after ${wAfter > capPct ? 'over' : ''}`}
            style={{ width: `${Math.min(100, (wAfter / 40) * 100)}%` }}
          />
          <div className="cap-mark" style={{ left: `${(capPct / 40) * 100}%` }} />
        </div>
      </div>

      <div className={`ticket-msg ${p.ok ? 'ok' : 'err'}`}>{p.ok ? 'ORDER VALID' : p.error}</div>
      <button className="execute" type="submit" disabled={!p.ok}>
        {side} {p.qty || 0} {ticker} <span className="go-tag">&lt;GO&gt;</span>
      </button>
    </form>
  );
}
