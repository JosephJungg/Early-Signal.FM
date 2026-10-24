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
        <p className="login-sub">FANTASY MUSIC MARKET · 10,000 CR TO START</p>
        <label htmlFor="player">ENTER PLAYER NAME</label>
        <div className="cmd">
          <span className="cmd-prompt">&gt;</span>
          <input
            id="player"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, ''))}
            placeholder="3-20 letters, numbers or _"
          />
          <button className="go" type="submit" disabled={busy || name.trim().length < 3}>
            {busy ? '…' : 'GO'}
          </button>
        </div>
        {error && <div className="login-err">{error.message.toUpperCase()}</div>}
        {error?.network && api.source !== 'mock' && (
          <button type="button" className="link" onClick={onUseMock}>
            Backend not running? Use mock data instead
          </button>
        )}
        <p className="login-foot">{api.source === 'mock' ? 'MOCK DATA · IN-BROWSER ONLY' : 'CONNECTED TO EARLYSIGNAL API'}</p>
      </form>
    </div>
  );
}
