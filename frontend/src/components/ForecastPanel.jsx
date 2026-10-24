import { num, pct, tone } from '../format.js';

export default function ForecastPanel({ fc, price }) {
  if (!fc) {
    return (
      <div className="empty">
        <b>NO FORECAST YET</b>
        <span>Waiting on the GPR model to write forecasts for this artist. The cone and signal appear here once it does.</span>
      </div>
    );
  }
  return (
    <div className="fcst">
      <div className="fcst-summary">
        <div>
          <span className="lbl">SIGNAL</span>
          <b className={`sig-big sig-${fc.signal.toLowerCase()}`}>{fc.signal}</b>
        </div>
        <div>
          <span className="lbl">{fc.points.length}D EXP RTN</span>
          <b className={tone(fc.expRet)}>{pct(fc.expRet * 100)}</b>
        </div>
        <div>
          <span className="lbl">90% BAND</span>
          <b>
            {num(fc.end.lower)} – {num(fc.end.upper)}
          </b>
        </div>
        <div>
          <span className="lbl">RTN / UNCERT</span>
          <b className={tone(fc.score)}>{num(fc.score, 2)}</b>
        </div>
      </div>
      <table className="grid-table compact">
        <thead>
          <tr>
            <th className="l">DATE</th>
            <th>LOWER</th>
            <th>MEAN</th>
            <th>UPPER</th>
            <th>Δ%</th>
          </tr>
        </thead>
        <tbody>
          {fc.points.map((p, i) => (
            <tr key={p.date}>
              <td className="l muted">D+{i + 1} <span className="dim">{p.date.slice(5)}</span></td>
              <td className="down">{num(p.lower)}</td>
              <td className="cyan">{num(p.mean)}</td>
              <td className="up">{num(p.upper)}</td>
              <td className={tone(p.mean - price)}>{pct((p.mean / price - 1) * 100, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
