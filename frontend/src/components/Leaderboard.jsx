import { num, pct, tone } from '../format.js';

const STARTING_CASH = 10000;
const TAG = { ai: 'AI', bot: 'BOT', you: 'YOU' };

// Rank movement since yesterday, worked out from everyone's prevValue.
function prevRanks(players) {
  const order = [...players].sort((a, b) => (b.prevValue ?? b.totalValue) - (a.prevValue ?? a.totalValue));
  return Object.fromEntries(order.map((p, i) => [p.userId, i + 1]));
}

export default function Leaderboard({ players }) {
  if (players.length === 0) return <div className="empty"><span>No players yet.</span></div>;
  const before = prevRanks(players);
  return (
    <table className="grid-table compact lead">
      <thead>
        <tr>
          <th className="l">#</th>
          <th className="l">PLAYER</th>
          <th>NET WORTH</th>
          <th title="Change since yesterday">TODAY</th>
          <th title="Gain or loss since the start (10,000)">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => {
          const d1 = p.prevValue ? ((p.totalValue - p.prevValue) / p.prevValue) * 100 : 0;
          const total = (p.totalValue / STARTING_CASH - 1) * 100;
          const moved = before[p.userId] - p.rank;
          return (
            <tr key={p.userId} className={`lead-${p.kind}`}>
              <td className="l rank">
                {p.rank}
                {moved !== 0 && (
                  <span className={`move ${moved > 0 ? 'up' : 'down'}`} title={`${moved > 0 ? 'Up' : 'Down'} ${Math.abs(moved)} since yesterday`}>
                    {moved > 0 ? '▲' : '▼'}{Math.abs(moved)}
                  </span>
                )}
              </td>
              <td className="l">
                {p.username}
                {TAG[p.kind] && <span className={`tag tag-${p.kind}`}>{TAG[p.kind]}</span>}
              </td>
              <td>{num(p.totalValue)}</td>
              <td className={tone(d1)}>{pct(d1, 1)}</td>
              <td className={tone(total)}>{pct(total, 1)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
