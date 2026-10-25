import { num, pct, signed, tone } from '../format.js';

const STARTING_CASH = 10000;

export default function Portfolio({ account, tab, highlight, onSelect }) {
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
        <div><span className="lbl">NET WORTH</span><b className="worth">{num(totalValue)}</b></div>
        <div><span className="lbl">CASH</span><b>{num(cash)}</b></div>
        <div title="Gain or loss since you started with 10,000"><span className="lbl">PROFIT</span><b className={tone(pnl)}>{signed(pnl)}</b></div>
        <div><span className="lbl">RETURN</span><b className={tone(pnl)}>{pct((pnl / STARTING_CASH) * 100)}</b></div>
      </div>

      {tab === 'HOLDINGS' ? (
        rows.length === 0 ? (
          <div className="empty">
            <b>You don't own any artists yet</b>
            <span>
              Pick an artist on the left, then press <span className="keycap buy">F2</span> or the green BUY button. Or type{' '}
              <span className="amber">BUY NETT 10</span> in the command box.
            </span>
          </div>
        ) : (
          <table className="grid-table compact">
            <thead>
              <tr>
                <th className="l">ARTIST</th>
                <th>SHARES</th>
                <th className="col-wide" title="Average price you paid per share">PAID</th>
                <th>NOW</th>
                <th>VALUE</th>
                <th title="Gain or loss on this artist">PROFIT</th>
                <th className="col-wide" title="Share of your net worth (limit 30%)">% OF YOU</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={highlight?.ticker === r.ticker ? `${r.ticker}-${highlight.key}` : r.ticker}
                  className={highlight?.ticker === r.ticker ? 'just-traded' : ''}
                  onClick={() => onSelect(r.ticker)}
                >
                  <td className="l tkr">{r.ticker}</td>
                  <td>{r.shares}</td>
                  <td className="col-wide muted">{num(r.avgCost)}</td>
                  <td>{num(r.price)}</td>
                  <td>{num(r.value)}</td>
                  <td className={tone(r.pnl)}>{signed(r.pnl)}</td>
                  <td className="col-wide">
                    <div className="wbar"><i style={{ width: `${(r.weight / 0.3) * 100}%` }} /></div>
                    {num(r.weight * 100, 0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : transactions.length === 0 ? (
        <div className="empty"><span>No trades yet. Your buys and sells will be listed here.</span></div>
      ) : (
        <table className="grid-table compact">
          <thead>
            <tr>
              <th className="l">DAY</th>
              <th className="l">TRADE</th>
              <th className="l">ARTIST</th>
              <th>SHARES</th>
              <th>PRICE</th>
              <th>FEE</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} onClick={() => onSelect(tx.ticker)}>
                <td className="l muted">{tx.day ?? tx.gameDate}</td>
                <td className={`l ${tx.side === 'BUY' ? 'up' : 'down'}`}>{tx.side === 'BUY' ? 'Bought' : 'Sold'}</td>
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
