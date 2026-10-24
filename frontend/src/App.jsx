import { useCallback, useState } from 'react';
import Terminal from './Terminal.jsx';
import Login from './components/Login.jsx';
import { httpApi } from './api/client.js';
import { mockApi } from './api/mockApi.js';

// VITE_DATA_SOURCE=mock starts on fake data; otherwise the real API (with a fallback button).
const START_SOURCE = import.meta.env.VITE_DATA_SOURCE === 'mock' ? 'mock' : 'api';
const APIS = { api: httpApi, mock: mockApi };

const storageKey = (source) => `earlysignal.user.${source}`;
function loadUser(source) {
  // Mock data lives only in memory, so a saved mock player wouldn't exist after a reload.
  if (source === 'mock') return null;
  try {
    return JSON.parse(localStorage.getItem(storageKey(source)));
  } catch {
    return null;
  }
}
function saveUser(source, user) {
  try {
    if (user) localStorage.setItem(storageKey(source), JSON.stringify(user));
    else localStorage.removeItem(storageKey(source));
  } catch {
    // Storage blocked (private mode etc.): the player just logs in again next time.
  }
}

export default function App() {
  const [source, setSource] = useState(START_SOURCE);
  const [user, setUser] = useState(() => loadUser(START_SOURCE));
  const api = APIS[source];

  const login = (u) => {
    saveUser(source, u);
    setUser(u);
  };
  const logout = useCallback(() => {
    saveUser(source, null);
    setUser(null);
  }, [source]);
  const switchToMock = () => {
    setSource('mock');
    setUser(null);
  };

  if (!user) return <Login api={api} onLogin={login} onUseMock={switchToMock} />;
  return <Terminal key={`${source}-${user.id}`} api={api} user={user} onLogout={logout} onUseMock={switchToMock} />;
}
