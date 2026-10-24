// Thin wrapper over the Spring Boot API (see backend/CLAUDE.md for the contract).
// In dev, Vite proxies /api to localhost:8080. For a deployed build, set VITE_API_URL.
const BASE = import.meta.env.VITE_API_URL ?? '';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY;

export class ApiError extends Error {
  constructor(message, { status = 0, network = false } = {}) {
    super(message);
    this.status = status;
    this.network = network;
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('API UNREACHABLE', { network: true });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // The proxy answers 5xx with no JSON when the backend is down.
    const network = res.status >= 500 && !data?.error;
    throw new ApiError(data?.error ?? `HTTP ${res.status}`, { status: res.status, network });
  }
  return data;
}

export const httpApi = {
  source: 'api',
  createUser: (username) => request('/api/users', { method: 'POST', body: { username } }),
  game: () => request('/api/game'),
  artists: () => request('/api/artists'),
  history: (id) => request(`/api/artists/${id}/history`),
  forecast: (id) => request(`/api/artists/${id}/forecast`),
  events: (limit = 60) => request(`/api/events?limit=${limit}`),
  portfolio: (userId) => request(`/api/portfolio/${userId}`),
  transactions: (userId) => request(`/api/transactions/${userId}`),
  leaderboard: (limit = 50) => request(`/api/leaderboard?limit=${limit}`),
  trade: (userId, ticker, side, shares) =>
    request('/api/trades', { method: 'POST', body: { userId, ticker, side, shares } }),
  advanceDay: (days = 1) =>
    request(`/api/admin/advance-day?days=${days}`, {
      method: 'POST',
      headers: ADMIN_KEY ? { 'X-Admin-Key': ADMIN_KEY } : {},
    }),
};
