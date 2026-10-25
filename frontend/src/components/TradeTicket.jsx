import { POSITION_CAP, maxBuy, previewTrade } from '../trading.js';
import { num } from '../format.js';

const capPct = POSITION_CAP * 100;

// Plain-language reasons the order can't go through yet.
function reason(p, side, ticker) {
  if (p.ok) return null;
  if (p.error.startsWith('QUANTITY')) return 'Enter how many shares.';
  if (p.error.startsWith('INSUFFICIENT')) return 'Not enough cash for that many shares.';
  if (p.error.startsWith('EXCEEDS')) return `Too much in one artist: you can put at most ${capPct}% of your money into ${ticker}.`;
  if (side === 'SELL') return p.sharesBefore ? `You only own ${p.sharesBefore} shares.` : `You don't own any ${ticker} yet.`;
  return p.error;
}

export default function TradeTicket({ artist, account, side, setSide, qty, setQty, qtyRef, busy, feedback, onExecute }) {
  const ticker = artist.ticker;
  const sharesHeld = account.holdings[ticker]?.shares ?? 0;
  const ctx = { price: artist.price, cash: account.cash, totalValue: account.totalValue, sharesHeld };
  const p = previewTrade({ ...ctx, side, qty: qty || 0 });
  const max = side === 'BUY' ? maxBuy(ctx) : sharesHeld;
  const wAfter = (p.weightAfter ?? p.weightBefore ?? 0) * 100;
  const why = reason(p, side, ticker);

  const submit = (e) => {
    e.preventDefault();
    if (p.ok && !busy) onExecute(side, ticker, p.qty);
  };

  return (
    <form className={`ticket side-${side.toLowerCase()}`} onSubmit={submit}>
      <div className="side-toggle">
        {['BUY', 'SELL'].map((sd) => (
          <button type="button" key={sd} className={side === sd ? `on ${sd.toLowerCase()}` : ''} onClick={() => setSide(sd)}>
            {sd} {ticker}
          </button>
        ))}
      </div>

      <div className="kv">
        <span>Shares</span>
        <div className="qty-row">
          <input
            ref={qtyRef}
            type="number"
            min="0"
            value={qty}
            aria-label="Number of shares"
            onChange={(e) => setQty(e.target.value === '' ? '' : Math.max(0, Math.floor(+e.target.value)))}
          />
          {[1, 10, 25].map((n) => (
            <button type="button" key={n} onClick={() => setQty(n)}>{n}</button>
          ))}
          <button type="button" onClick={() => setQty(max)} title={side === 'BUY' ? 'Most you can buy' : 'Sell everything'}>
            MAX
          </button>
        </div>
        <span>Price per share</span>
        <b>{num(artist.price)}</b>
        <span className="term" title="Every trade costs 1% of its value">Fee (1%)</span>
        <b>{num(p.fee ?? 0)}</b>
        <span>{side === 'BUY' ? 'You pay' : 'You get'}</span>
        <b className="total">{num(p.total ?? 0)} CR</b>
        <span>Cash after</span>
        <b>{num(p.cashAfter ?? account.cash)}</b>
        <span>You'll own</span>
        <b>{p.sharesAfter ?? sharesHeld} shares</b>
      </div>

      <div className="cap" title={`No single artist can be more than ${capPct}% of your net worth`}>
        <div className="cap-label">
          <span>{ticker} would be {num(wAfter, 0)}% of your money</span>
          <span>limit {capPct}%</span>
        </div>
        <div className="cap-bar">
          <div className={`cap-fill ${wAfter > capPct ? 'over' : ''}`} style={{ width: `${Math.min(100, (wAfter / 40) * 100)}%` }} />
          <div className="cap-mark" style={{ left: `${(capPct / 40) * 100}%` }} />
        </div>
      </div>

      {feedback ? (
        <div key={feedback.key} className={`ticket-msg ${feedback.kind}`}>{feedback.text}</div>
      ) : (
        <div className={`ticket-msg ${why ? 'err' : 'hint'}`}>{why ?? 'Press Enter or the button to place the order.'}</div>
      )}
      <button className="execute" type="submit" disabled={!p.ok || busy}>
        {busy ? 'SENDING…' : `${side} ${p.qty || 0} ${ticker}`}
      </button>
    </form>
  );
}
