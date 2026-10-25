import { num, pct, tone } from '../format.js';
import { useFlash } from '../useFlash.js';

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true" />
      <span className="brand-name">
        EARLY-SIGNAL<span className="brand-sub">.FM</span>
      </span>
    </div>
  );
}

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();

const STARTING_CASH = 10000;

export default function TopBar({ cmdRef, onCommand, source, online, username, day, gameDate, cash, worth, busy, blocked, onAdvance, onLogout }) {
  const worthFlash = useFlash(worth);
  const cashFlash = useFlash(cash);
  const profit = worth - STARTING_CASH;

  const submit = (e) => {
    e.preventDefault();
    const v = cmdRef.current.value.trim();
    if (v) onCommand(v);
    cmdRef.current.value = '';
  };

  return (
    <header className="topbar">
      <Brand />
      <div className="day-badge" title="Game day. Press ADVANCE DAY to move to the next one.">
        <b>DAY {day}</b>
        <span>{fmtDate(gameDate)}</span>
      </div>

      <form className="cmd" onSubmit={submit}>
        <span className="cmd-prompt">&gt;</span>
        <input ref={cmdRef} spellCheck={false} autoComplete="off" placeholder="Type a command, e.g. BUY NETT 10" />
        <button className="go" type="submit">GO</button>
      </form>

      <div className="topbar-meta">
        {source === 'mock' ? (
          <span className="source mock" title="Fake in-browser data, not the backend"><i /> PRACTICE DATA</span>
        ) : online ? (
          <span className="source live" title="Connected to the game server. Artist names are real; prices, listener numbers and news are simulated for the game."><i /> LIVE · SIMULATED</span>
        ) : (
          <span className="source offline" title="Can't reach the game server, retrying"><i /> OFFLINE</span>
        )}
        <div className={`stat ${worthFlash}`} title="Cash plus the current value of your shares. The colored number is your gain or loss since you started with 10,000.">
          <span>NET WORTH</span>
          <b>
            {num(worth)}
            <em className={tone(profit)}>
              {pct((profit / STARTING_CASH) * 100, 1)} since start
            </em>
          </b>
        </div>
        <div className={`stat ${cashFlash}`} title="Credits you can spend right now">
          <span>CASH</span>
          <b>{num(cash)}</b>
        </div>
        <button className="user" onClick={onLogout} title="Switch player">{username} ⏏</button>
        <button
          className="adv"
          onClick={onAdvance}
          disabled={busy || blocked}
          title={blocked ? 'Close the day summary first' : 'Move the game forward one day (F8)'}
        >
          {busy ? 'ADVANCING…' : 'ADVANCE DAY ▶'}
        </button>
      </div>
    </header>
  );
}
