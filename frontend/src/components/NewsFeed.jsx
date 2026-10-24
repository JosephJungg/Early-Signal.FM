import { arrow, pct, tone } from '../format.js';

export default function NewsFeed({ events, day, onSelect }) {
  return (
    <ul className="news">
      {events.map((e, i) => (
        <li key={`${e.day}-${e.ticker}-${i}`} className={e.day === day ? 'fresh' : ''} onClick={() => onSelect(e.ticker)}>
          <div className="news-top">
            <span className="muted">D{e.day}</span>
            <span className={`news-type ${tone(e.impactPct)}`}>
              {arrow(e.impactPct)} {e.type}
            </span>
            <b className="amber">{e.ticker}</b>
            <span className={tone(e.impactPct)}>{pct(e.impactPct, 1)}</span>
          </div>
          <div className="news-head">{e.headline}</div>
        </li>
      ))}
    </ul>
  );
}
