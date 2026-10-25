import { arrow, compact, num, pct, tone } from '../format.js';

const SIGNAL_TIP = {
  BUY: 'The model expects this price to rise more than its uncertainty',
  SELL: 'The model expects this price to fall',
  HOLD: 'No strong signal either way',
};

function Spark({ history }) {
  const pts = history.slice(-14).map((p) => p.price);
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * 64},${16 - ((v - min) / span) * 14 - 1}`).join(' ');
  const up = pts[pts.length - 1] >= pts[0];
  return (
    <svg className="spark" viewBox="0 0 64 16" preserveAspectRatio="none" aria-hidden="true">
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
            <th className="l">ARTIST</th>
            <th>PRICE</th>
            <th title="Price change since yesterday">TODAY</th>
            <th className="col-wide" title="Price over the last two weeks">2 WEEKS</th>
            <th className="col-wide" title="Monthly listeners: the streaming numbers that drive the price">LISTENERS</th>
            <th title="What the forecast model expects over the next 7 days">OUTLOOK</th>
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
                <td className="l">
                  <div className="artist">
                    <b>
                      {held[a.ticker] && <span className="held-dot" title="You own this artist" />}
                      {a.ticker}
                    </b>
                    <span title={a.genre}>{a.name}</span>
                  </div>
                </td>
                <td className="px moved">{num(a.price)}</td>
                <td className={`${tone(a.changePct)} moved`}>
                  {arrow(a.changePct)} {pct(a.changePct, 1)}
                </td>
                <td className="col-wide"><Spark history={a.history} /></td>
                <td className="col-wide muted">{compact(a.listeners)}</td>
                <td>
                  {a.fc ? (
                    <span className={`chip ${a.fc.signal.toLowerCase()}`} title={SIGNAL_TIP[a.fc.signal]}>
                      {a.fc.signal} {pct(a.fc.expRet * 100, 0)}
                    </span>
                  ) : (
                    <span className="faint">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
