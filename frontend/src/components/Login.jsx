import { useState } from 'react';
import { Brand } from './TopBar.jsx';

// No real auth in the plan: picking a name creates the player (or returns the existing one).
export default function Login({ api, onLogin, onUseMock }) {
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await api.createUser(name.trim());
      onLogin({ id: u.id, username: u.username });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <form className="login" onSubmit={submit}>
        <Brand />
        <p className="login-pitch">
          Trade music artists like stocks. Start with <b>10,000 credits</b>, buy the artists you think will blow up,
          and climb the leaderboard against other players and an AI.
        </p>
        <label htmlFor="player">PICK A PLAYER NAME</label>
        <div className="cmd">
          <span className="cmd-prompt">&gt;</span>
          <input
            id="player"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))}
            placeholder="your name"
          />
          <button className="go" type="submit" disabled={busy || name.trim().length < 3}>
            {busy ? '…' : 'PLAY ▶'}
          </button>
        </div>
        <p className="login-sub">3 to 20 letters or numbers. Use the same name later to pick up where you left off.</p>
        {error && <div className="login-err">{error.network ? "Can't reach the game server." : error.message}</div>}
        {error?.network && api.source !== 'mock' && (
          <button type="button" className="link" onClick={onUseMock}>
            Play with practice data instead
          </button>
        )}
        <p className="login-foot">{api.source === 'mock' ? 'PRACTICE DATA · STAYS IN THIS BROWSER' : 'CONNECTED TO THE EARLYSIGNAL GAME SERVER'}</p>
      </form>
    </div>
  );
}
