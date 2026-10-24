import { pct } from '../format.js';

export default function NewsFeed({ events, day, onSelect }) {
  if (events.length === 0) return <div className="empty"><span>No news yet. Advance a day to see what happens.</span></div>;
  return (
    <ul className="news">
      {events.map((e) => {
        const fresh = e.day === day;
        return (
          <li key={e.id} className={fresh ? 'fresh' : ''} onClick={() => onSelect(e.ticker)} title="Show this artist">
            <div className="news-top">
              {fresh ? <span className="new-tag">NEW</span> : <span className="faint">DAY {e.day}</span>}
              <span className={`news-type ${e.positive ? 'up' : 'down'}`}>{e.label}</span>
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
