import { quote } from '../mock/engine.js';
import { arrow, num, pct, tone } from '../format.js';

export default function TickerTape({ artists, onSelect }) {
  const items = Object.values(artists).map((a) => ({ a, q: quote(a) }));
  // Render the list twice so the CSS scroll loops seamlessly.
  const row = (dup) =>
    items.map(({ a, q }) => (
      <button key={a.ticker + dup} className="tape-item" onClick={() => onSelect(a.ticker)}>
        <b>{a.ticker}</b> {num(q.price)}{' '}
        <span className={tone(q.change)}>
          {arrow(q.change)} {pct(q.changePct, 1)}
        </span>
      </button>
    ));
  return (
    <div className="tape">
      <span className="tape-label">ES MUSIC INDEX</span>
      <div className="tape-track">
        <div className="tape-inner">
          {row('a')}
          {row('b')}
        </div>
      </div>
    </div>
  );
}
