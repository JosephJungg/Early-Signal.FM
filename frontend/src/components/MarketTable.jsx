import { forecast, quote } from '../mock/engine.js';
import { arrow, compact, num, pct, signed, tone } from '../format.js';

function Spark({ history }) {
  const pts = history.slice(-14).map((p) => p.price);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * 60},${14 - ((v - min) / span) * 12 - 1}`).join(' ');
  const up = pts[pts.length - 1] >= pts[0];
  return (
    <svg className="spark" viewBox="0 0 60 14" preserveAspectRatio="none">
      <polyline points={d} className={up ? 'spark-up' : 'spark-down'} />
    </svg>
  );
}

export default function MarketTable({ rows, day, flashes, selected, held, onSelect }) {
  return (
    <div className="table-wrap">
      <table className="grid-table market">
        <thead>
          <tr>
            <th>TKR</th>
            <th className="l">ARTIST</th>
            <th>LAST</th>
            <th>CHG</th>
            <th>%CHG</th>
            <th>14D</th>
            <th>LSTNR</th>
            <th>7D FCST</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const q = quote(a);
            const f = forecast(a);
            const flash = flashes[a.ticker];
            return (
              <tr
                key={`${a.ticker}-${day}`}
                className={`${selected === a.ticker ? 'sel' : ''} ${flash ? `flash-${flash}` : ''}`}
                onClick={() => onSelect(a.ticker)}
              >
                <td className="tkr">
                  {held[a.ticker] && <span className="held-dot" title="In portfolio">●</span>}
                  {a.ticker}
                </td>
                <td className="l name">
                  {a.name}
                  <span className="genre">{a.genre}</span>
                </td>
                <td className="px">{num(q.price)}</td>
                <td className={tone(q.change)}>{signed(q.change)}</td>
                <td className={tone(q.change)}>
                  {arrow(q.change)} {pct(q.changePct, 1)}
                </td>
                <td><Spark history={a.history} /></td>
                <td className="muted">{compact(q.listeners)}</td>
                <td className={`fc fc-${f.signal.toLowerCase()}`}>
                  {pct(f.expRet * 100, 1)} <span className="sig">{f.signal}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
