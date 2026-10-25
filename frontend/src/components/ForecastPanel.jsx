import { num, pct, tone } from '../format.js';

const SAY = {
  BUY: 'expects it to rise',
  SELL: 'expects it to fall',
  HOLD: 'sees no clear direction',
};

export default function ForecastPanel({ artist }) {
  const fc = artist.fc;
  if (!fc) {
    return (
      <div className="empty">
        <b>No forecast yet</b>
        <span>The forecast model hasn't run for {artist.ticker} yet. It usually appears shortly after each new day.</span>
      </div>
    );
  }
  const price = artist.price;
  return (
    <div className="fcst">
      <div className="fcst-say">
        <span className={`chip ${fc.signal.toLowerCase()}`}>{fc.signal}</span>
        The model {SAY[fc.signal]}.
        <p>
          In {fc.points.length} days: about <b className="cyan">{num(fc.end.mean)}</b> (
          <span className={tone(fc.expRet)}>{pct(fc.expRet * 100, 1)}</span>), most likely between{' '}
          <b>{num(fc.end.lower)}</b> and <b>{num(fc.end.upper)}</b>.
        </p>
      </div>
      <table className="grid-table compact">
        <thead>
          <tr>
            <th className="l">DAY</th>
            <th title="Low end of the likely range">LOW</th>
            <th title="The model's best guess">EXPECTED</th>
            <th title="High end of the likely range">HIGH</th>
            <th title="Expected change from today">VS TODAY</th>
          </tr>
        </thead>
        <tbody>
          {fc.points.map((p, i) => (
            <tr key={p.date}>
              <td className="l muted">+{i + 1}d</td>
              <td className="bound">{num(p.lower)}</td>
              <td className="cyan">{num(p.mean)}</td>
              <td className="bound">{num(p.upper)}</td>
              <td className={tone(p.mean - price)}>{pct((p.mean / price - 1) * 100, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
