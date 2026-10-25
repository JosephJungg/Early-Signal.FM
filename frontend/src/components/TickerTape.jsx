import { arrow, num, pct, tone } from '../format.js';

export default function TickerTape({ artists, onSelect }) {
  const items = Object.values(artists);
  // Render the list twice so the CSS scroll loops seamlessly.
  const row = (dup) =>
    items.map((a) => (
      <button key={a.ticker + dup} className="tape-item" onClick={() => onSelect(a.ticker)} tabIndex={dup === 'b' ? -1 : 0}>
        <b>{a.ticker}</b> {num(a.price)}{' '}
        <span className={tone(a.changePct)}>
          {arrow(a.changePct)} {pct(a.changePct, 1)}
        </span>
      </button>
    ));
  return (
    <div className="tape">
      <span className="tape-label">TODAY</span>
      <div className="tape-track">
        <div className="tape-inner">
          {row('a')}
          {row('b')}
        </div>
      </div>
    </div>
  );
}
