import { useEffect, useState } from 'react';
import { num, pct, tone } from '../format.js';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">◢◤</span>
      <span className="brand-name">EARLYSIGNAL</span>
      <span className="brand-sub">TERMINAL</span>
    </div>
  );
}

export default function TopBar({ cmdRef, onCommand, source, online, username, dayNumber, gameDate, cash, worth, worthChangePct, busy, onAdvance, onLogout }) {
  const now = useClock();
  const stamp = now
    .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const submit = (e) => {
    e.preventDefault();
    const v = cmdRef.current.value.trim();
    if (v) onCommand(v);
    cmdRef.current.value = '';
  };

  return (
    <header className="topbar">
      <Brand />

      <form className="cmd" onSubmit={submit}>
        <span className="cmd-prompt">&gt;</span>
        <input
          ref={cmdRef}
          spellCheck={false}
          autoComplete="off"
          placeholder="BUY LUNA 10 · SELL KAI ALL · FCST LUNA · HELP"
        />
        <button className="go" type="submit">GO</button>
      </form>

      <div className="topbar-meta">
        {source === 'mock' ? (
          <span className="live mock" title="Fake in-browser data, not the backend"><i /> MOCK DATA</span>
        ) : online ? (
          <span className="live"><i /> LIVE</span>
        ) : (
          <span className="live offline"><i /> API OFFLINE</span>
        )}
        <span className="meta-item"><b>DAY</b> {dayNumber}</span>
        <span className="meta-item" title="Game date"><b>GAME</b> {gameDate}</span>
        <span className="meta-item muted">{stamp}</span>
        <span className="meta-item"><b>NET</b> {num(worth)} <em className={tone(worthChangePct)}>{pct(worthChangePct)}</em></span>
        <span className="meta-item cash">{num(cash)} CR</span>
        <button className="user" onClick={onLogout} title="Switch player">{username} ⏏</button>
        <button className="adv" onClick={onAdvance} disabled={busy} title="F8">
          {busy ? 'ADVANCING…' : 'ADVANCE DAY ▶'}
        </button>
      </div>
    </header>
  );
}
