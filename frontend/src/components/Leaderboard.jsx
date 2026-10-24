import { STARTING_CASH } from '../mock/engine.js';
import { arrow, num, pct, tone } from '../format.js';

const TAG = { ai: 'AI', bot: 'BOT', you: 'YOU' };

export default function Leaderboard({ players }) {
  const ranked = [...players].sort((a, b) => b.value - a.value);
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
        {ranked.map((p, i) => {
          const d1 = p.value - p.prevValue;
          const total = (p.value / STARTING_CASH - 1) * 100;
          return (
            <tr key={p.id} className={`lead-${p.kind}`}>
              <td className="l rank">{i + 1}</td>
              <td className="l">
                {p.name}
                {TAG[p.kind] && <span className={`tag tag-${p.kind}`}>{TAG[p.kind]}</span>}
              </td>
              <td>{num(p.value)}</td>
              <td className={tone(d1)}>{arrow(d1)}</td>
              <td className={tone(total)}>{pct(total, 1)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
