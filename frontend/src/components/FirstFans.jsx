import { useEffect, useState } from 'react';
import { num, pct, tone } from '../format.js';

const TAG = { ai: 'AI', bot: 'BOT', you: 'YOU' };

// "OCT 24" in the table (it's narrow); the full date and game day go in the tooltip.
const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();
const longDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

// The selected artist's fans, ranked by who bought first. Refetches whenever `refreshKey` changes
// (each market poll), so new buyers show up without a reload.
export default function FirstFans({ api, artist, userId, refreshKey }) {
  const [state, setState] = useState({ id: null, fans: null, error: null });

  useEffect(() => {
    let live = true;
    api
      .fans(artist.id, 50)
      .then((fans) => live && setState({ id: artist.id, fans, error: null }))
      .catch((error) => live && setState((s) => ({ ...s, error })));
    return () => {
      live = false;
    };
  }, [api, artist.id, refreshKey]);

  const fans = state.id === artist.id ? state.fans : null;
  const head = (
    <div className="fans-head">
      <span className="tkr">{artist.ticker}</span> {artist.name} <span className="muted">· first buyers on top</span>
    </div>
  );

  if (!fans) {
    return (
      <div className="fans">
        {head}
        <div className="empty"><span>{state.error ? "Couldn't load fans right now." : 'Loading fans…'}</span></div>
      </div>
    );
  }
  if (fans.length === 0) {
    return (
      <div className="fans">
        {head}
        <div className="empty">
          <b>Nobody has bought {artist.ticker} yet</b>
          <span>Buy a share now and you'll be its #1 fan.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fans">
      {head}
      <table className="grid-table compact lead">
        <thead>
          <tr>
            <th className="l">#</th>
            <th className="l">PLAYER</th>
            <th className="l" title="The day they first bought this artist">FAN SINCE</th>
            <th title="Price of their first share">PAID</th>
            <th title="How much the price has moved since their first buy">GAIN</th>
          </tr>
        </thead>
        <tbody>
          {fans.map((f) => {
            const kind = f.userId === userId ? 'you' : f.kind;
            const gain = (artist.price / f.firstPrice - 1) * 100;
            const soldOut = f.shares === 0;
            return (
              <tr key={f.userId} className={`lead-${kind} ${soldOut ? 'fan-sold' : ''}`}>
                <td className="l rank">{f.rank}</td>
                <td className="l">
                  {f.username}
                  {TAG[kind] && <span className={`tag tag-${kind}`}>{TAG[kind]}</span>}
                  {soldOut && <span className="tag tag-sold" title="Sold all their shares, but keeps their spot">SOLD</span>}
                </td>
                <td className="l" title={`${longDate(f.since)} · day ${f.day}`}>{shortDate(f.since)}</td>
                <td>{num(f.firstPrice)}</td>
                <td className={tone(gain)}>{pct(gain, Math.abs(gain) >= 100 ? 0 : 1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
