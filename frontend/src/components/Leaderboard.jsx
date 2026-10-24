import { arrow, num, pct, tone } from '../format.js';

const STARTING_CASH = 10000;
const TAG = { ai: 'AI', bot: 'BOT', you: 'YOU' };

export default function Leaderboard({ players }) {
  return (
    <table className="grid-table compact lead">
      <thead>
        <tr>
          <th className="l">#</th>
          <th className="l">PLAYER</th>
          <th>NET WORTH</th>
          <th>1D</th>
          <th>TOTAL</th>
        </tr>
      </thead>
      <tbody>
        {players.length === 0 && (
          <tr><td colSpan={5} className="l muted">NO PLAYERS YET</td></tr>
        )}
        {players.map((p) => {
          const d1 = p.prevValue === undefined ? 0 : p.totalValue - p.prevValue;
          const total = (p.totalValue / STARTING_CASH - 1) * 100;
          return (
            <tr key={p.userId} className={`lead-${p.kind}`}>
              <td className="l rank">{p.rank}</td>
              <td className="l">
                {p.username}
                {TAG[p.kind] && <span className={`tag tag-${p.kind}`}>{TAG[p.kind]}</span>}
              </td>
              <td>{num(p.totalValue)}</td>
              <td className={tone(d1)}>{arrow(d1)}</td>
              <td className={tone(total)}>{pct(total, 1)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
