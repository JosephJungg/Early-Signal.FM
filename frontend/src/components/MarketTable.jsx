import { arrow, compact, num, pct, signed, tone } from '../format.js';

export const TIER_LABEL = { BLUE_CHIP: 'BLUE CHIP', MID: 'MID', UNDERGROUND: 'UNDERGROUND' };

function Spark({ history }) {
  const pts = history.slice(-14).map((p) => p.price);
  if (pts.length < 2) return null;
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

export default function MarketTable({ rows, version, flashes, selected, held, onSelect }) {
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
            const flash = flashes[a.ticker];
            return (
              <tr
                key={`${a.ticker}-${version}`}
                className={`${selected === a.ticker ? 'sel' : ''} ${flash ? `flash-${flash}` : ''}`}
                onClick={() => onSelect(a.ticker)}
              >
                <td className="tkr">
                  {held[a.ticker] && <span className="held-dot" title="In portfolio">●</span>}
                  {a.ticker}
                </td>
                <td className="l name">
                  {a.name}
                  <span className="genre">{TIER_LABEL[a.tier] ?? a.tier}</span>
                </td>
                <td className="px">{num(a.price)}</td>
                <td className={tone(a.change)}>{signed(a.change)}</td>
                <td className={tone(a.changePct)}>
                  {arrow(a.changePct)} {pct(a.changePct, 1)}
                </td>
                <td><Spark history={a.history} /></td>
                <td className="muted">{compact(a.listeners)}</td>
                {a.fc ? (
                  <td className={`fc fc-${a.fc.signal.toLowerCase()}`}>
                    {pct(a.fc.expRet * 100, 1)} <span className="sig">{a.fc.signal}</span>
                  </td>
                ) : (
                  <td className="muted">—</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
