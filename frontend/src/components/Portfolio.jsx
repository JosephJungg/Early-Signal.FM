import { STARTING_CASH, lastPoint, netWorth } from '../mock/engine.js';
import { num, pct, signed, tone } from '../format.js';

export default function Portfolio({ game, tab, onSelect }) {
  const { cash, holdings, transactions } = game.portfolio;
  const nw = netWorth(game);
  const pnl = nw - STARTING_CASH;
  const rows = Object.entries(holdings).map(([t, h]) => {
    const px = lastPoint(game.artists[t]).price;
    const value = h.shares * px;
    return { t, ...h, px, value, pnl: value - h.shares * h.avgCost, weight: value / nw };
  });

  return (
    <div className="port">
      <div className="port-summary">
        <div><span className="lbl">NET WORTH</span><b className="amber">{num(nw)}</b></div>
        <div><span className="lbl">CASH</span><b>{num(cash)}</b></div>
        <div><span className="lbl">TOTAL P&amp;L</span><b className={tone(pnl)}>{signed(pnl)}</b></div>
        <div><span className="lbl">RETURN</span><b className={tone(pnl)}>{pct((pnl / STARTING_CASH) * 100)}</b></div>
      </div>

      {tab === 'HOLDINGS' ? (
        <table className="grid-table compact">
          <thead>
            <tr>
              <th className="l">TKR</th>
              <th>SHS</th>
              <th>AVG</th>
              <th>LAST</th>
              <th>MKT VAL</th>
              <th>P&amp;L</th>
              <th>WGT</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="l muted">NO POSITIONS — TYPE BUY &lt;TKR&gt; &lt;QTY&gt;</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.t} onClick={() => onSelect(r.t)}>
                <td className="l tkr">{r.t}</td>
                <td>{r.shares}</td>
                <td className="muted">{num(r.avgCost)}</td>
                <td>{num(r.px)}</td>
                <td>{num(r.value)}</td>
                <td className={tone(r.pnl)}>{signed(r.pnl)}</td>
                <td>
                  <div className="wbar"><i style={{ width: `${(r.weight / 0.3) * 100}%` }} /></div>
                  <span className="muted">{num(r.weight * 100, 1)}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="grid-table compact">
          <thead>
            <tr>
              <th className="l">DAY</th>
              <th className="l">SIDE</th>
              <th className="l">TKR</th>
              <th>SHS</th>
              <th>PRICE</th>
              <th>FEE</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) => (
              <tr key={i} onClick={() => onSelect(tx.ticker)}>
                <td className="l muted">D{tx.day}</td>
                <td className={`l ${tx.side === 'BUY' ? 'up' : 'down'}`}>{tx.side}</td>
                <td className="l tkr">{tx.ticker}</td>
                <td>{tx.shares}</td>
                <td>{num(tx.price)}</td>
                <td className="muted">{num(tx.fee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
