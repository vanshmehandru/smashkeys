// HTTP API communications client
let token = localStorage.getItem('token') || null;

export function setToken(newToken) {
  token = newToken;
  if (newToken) {
    localStorage.setItem('token', newToken);
  } else {
    localStorage.removeItem('token');
  }
}

export function getToken() {
  return token;
}

export function hasToken() {
  return !!token;
}

// Request Helper
async function request(url, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = { method, headers };
  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'API Request failed');
  }
  return data;
}

// Auth endpoints
export async function register(username, email, password) {
  const data = await request('/api/auth/register', 'POST', { username, email, password });
  setToken(data.token);
  return data;
}

export async function login(email, password) {
  const data = await request('/api/auth/login', 'POST', { email, password });
  setToken(data.token);
  return data;
}

export async function getMe() {
  return await request('/api/auth/me');
}

export async function saveSettings(settings) {
  return await request('/api/auth/settings', 'POST', settings);
}

// Typing Stats endpoints
export async function saveSession(sessionData) {
  // sessionData: { modeType, modeVal, wpm, rawWpm, accuracy, errors, consistency, duration }
  return await request('/api/stats/save', 'POST', sessionData);
}

// Leaderboard query
export async function getLeaderboard(modeType, modeVal) {
  let url = `/api/leaderboard`;
  if (modeType || modeVal) {
    const params = [];
    if (modeType) params.push(`modeType=${modeType}`);
    if (modeVal) params.push(`modeVal=${modeVal}`);
    url += `?${params.join('&')}`;
  }
  return await request(url);
}

// User details query
export async function getUserProfile(username) {
  return await request(`/api/users/${username}`);
}
