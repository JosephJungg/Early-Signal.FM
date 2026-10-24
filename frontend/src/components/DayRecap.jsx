import { arrow, num, pct, signed, tone } from '../format.js';

/**
 * What changed after Advance Day, in plain words: your money first, then your artists,
 * your rank, the biggest movers, and the news. Built by buildRecap() from before/after snapshots.
 */
export function buildRecap(before, after, result) {
  const you = (m) => m.leaderboard.find((p) => p.kind === 'you');
  const worthBefore = before.account.totalValue;
  const worthAfter = after.account.totalValue;
  const yours = Object.values(after.account.holdings).map((h) => {
    const a = after.market.artists[h.ticker];
    return { ticker: h.ticker, changePct: a.changePct, gain: h.shares * a.change };
  });
  const movers = Object.values(after.market.artists)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 3);
  return {
    day: after.market.day,
    worthAfter,
    delta: worthAfter - worthBefore,
    deltaPct: worthBefore ? ((worthAfter - worthBefore) / worthBefore) * 100 : 0,
    rankBefore: you(before.market)?.rank,
    rankAfter: you(after.market)?.rank,
    players: after.market.leaderboard.length,
    yours: yours.sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain)),
    movers,
    events: (result?.events ?? []).slice(0, 3),
  };
}

export default function DayRecap({ recap, onClose, onSelect }) {
  const rankMove = recap.rankBefore && recap.rankAfter ? recap.rankBefore - recap.rankAfter : 0;
  return (
    <div className="recap" role="status" aria-live="polite">
      <div className="recap-head">
        DAY {recap.day} RESULTS <span>· here's what changed</span>
        <button onClick={onClose} aria-label="Close summary">✕</button>
      </div>
      <div className="recap-body">
        {recap.yours.length ? (
          <div className="recap-big">
            <b>{num(recap.worthAfter)}</b>
            <em className={tone(recap.delta)}>
              {arrow(recap.delta)} {signed(recap.delta)} ({pct(recap.deltaPct, 1)})
            </em>
            <div className="muted">your net worth {recap.delta >= 0 ? 'went up' : 'went down'} today</div>
          </div>
        ) : (
          <div className="recap-big">
            <div>You don't own any artists yet, so your money didn't move.</div>
            <div className="muted">Buy some shares, then advance again to see them change.</div>
          </div>
        )}

        {recap.yours.length > 0 && (
          <div className="recap-row">
            <span className="lbl">YOUR ARTISTS</span>
            {recap.yours.map((h) => (
              <button key={h.ticker} className="pill" onClick={() => onSelect(h.ticker)}>
                <b>{h.ticker}</b>
                <span className={tone(h.changePct)}>
                  {pct(h.changePct, 1)} ({signed(h.gain)})
                </span>
              </button>
            ))}
          </div>
        )}

        {recap.rankAfter && (
          <div className="recap-row">
            <span className="lbl">LEADERBOARD</span>
            <span>
              #{recap.rankAfter} of {recap.players}{' '}
              {rankMove > 0 && <span className="up">▲ up {rankMove}</span>}
              {rankMove < 0 && <span className="down">▼ down {-rankMove}</span>}
              {rankMove === 0 && <span className="muted">(no change)</span>}
            </span>
          </div>
        )}

        <div className="recap-row">
          <span className="lbl">BIGGEST MOVES</span>
          {recap.movers.map((a) => (
            <button key={a.ticker} className="pill" onClick={() => onSelect(a.ticker)}>
              <b>{a.ticker}</b>
              <span className={tone(a.changePct)}>{pct(a.changePct, 1)}</span>
            </button>
          ))}
        </div>

        {recap.events.length > 0 && (
          <div className="recap-row">
            <span className="lbl">NEWS</span>
            <ul className="recap-news">
              {recap.events.map((e) => (
                <li key={e.id}>
                  <b className={(e.impactPct ?? 0) >= 0 ? 'up' : 'down'}>{e.type}</b>
                  {e.headline}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="recap-foot">Changed numbers flash green or red on screen. Press ESC or ✕ to close.</div>
      </div>
    </div>
  );
}
