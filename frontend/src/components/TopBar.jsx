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

export default function TopBar({ cmdRef, onCommand, day, cash, worth, worthChangePct, onAdvance }) {
  const now = useClock();
  const stamp = now
    .toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .toUpperCase()
    .replace(',', '');

  const submit = (e) => {
    e.preventDefault();
    const v = cmdRef.current.value.trim();
    if (v) onCommand(v);
    cmdRef.current.value = '';
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">◢◤</span>
        <span className="brand-name">EARLYSIGNAL</span>
        <span className="brand-sub">TERMINAL</span>
      </div>

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
        <span className="live"><i /> SIM</span>
        <span className="meta-item"><b>DAY</b> {day}</span>
        <span className="meta-item">{stamp}</span>
        <span className="meta-item"><b>NET</b> {num(worth)} <em className={tone(worthChangePct)}>{pct(worthChangePct)}</em></span>
        <span className="meta-item cash">{num(cash)} CR</span>
        <button className="adv" onClick={onAdvance} title="F8">
          ADVANCE DAY ▶
        </button>
      </div>
    </header>
  );
}
