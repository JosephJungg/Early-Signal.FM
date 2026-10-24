import { pct } from '../format.js';

export default function NewsFeed({ events, gameDate, onSelect }) {
  if (events.length === 0) return <div className="empty"><span>No events yet. Advance a day to see the wire move.</span></div>;
  return (
    <ul className="news">
      {events.map((e) => {
        const cls = e.positive ? 'up' : 'down';
        return (
          <li key={e.id} className={e.date === gameDate ? 'fresh' : ''} onClick={() => onSelect(e.ticker)}>
            <div className="news-top">
              <span className="muted">{e.date.slice(5)}</span>
              <span className={`news-type ${cls}`}>
                {e.positive ? '▲' : '▼'} {e.label}
              </span>
              <b className="amber">{e.ticker}</b>
              {e.pricePct !== null && <span className={e.pricePct >= 0 ? 'up' : 'down'}>{pct(e.pricePct, 1)}</span>}
            </div>
            <div className="news-head">{e.headline}</div>
          </li>
        );
      })}
    </ul>
  );
}
