import { num, pct, signed, tone } from '../format.js';

const STARTING_CASH = 10000;

export default function Portfolio({ account, tab, onSelect }) {
  const { cash, totalValue, holdings, transactions } = account;
  const pnl = totalValue - STARTING_CASH;
  const rows = Object.values(holdings).map((h) => ({
    ...h,
    pnl: h.value - h.shares * h.avgCost,
    weight: h.value / totalValue,
  }));

  return (
    <div className="port">
      <div className="port-summary">
        <div><span className="lbl">NET WORTH</span><b className="amber">{num(totalValue)}</b></div>
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
              <tr><td colSpan={7} className="l muted">NO POSITIONS · TYPE BUY &lt;TKR&gt; &lt;QTY&gt;</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.ticker} onClick={() => onSelect(r.ticker)}>
                <td className="l tkr">{r.ticker}</td>
                <td>{r.shares}</td>
                <td className="muted">{num(r.avgCost)}</td>
                <td>{num(r.price)}</td>
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
              <th className="l">DATE</th>
              <th className="l">SIDE</th>
              <th className="l">TKR</th>
              <th>SHS</th>
              <th>PRICE</th>
              <th>FEE</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr><td colSpan={6} className="l muted">NO TRADES YET</td></tr>
            )}
            {transactions.map((tx) => (
              <tr key={tx.id} onClick={() => onSelect(tx.ticker)}>
                <td className="l muted">{tx.gameDate}</td>
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
