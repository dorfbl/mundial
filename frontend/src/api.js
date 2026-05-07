import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://10.10.10.135:3001/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (username) => api.post('/auth/login', { username }),
  adminLogin: (password) => api.post('/auth/admin-login', { password }),
};

export const matchesApi = {
  getAll: () => api.get('/matches'),
  getOne: (id) => api.get(`/matches/${id}`),
  updateResult: (id, data) => api.put(`/matches/${id}/result`, data),
  sync: () => api.post('/admin/sync'),
};

export const betsApi = {
  getMy: () => api.get('/bets/my'),
  getForMatch: (matchId) => api.get(`/bets/match/${matchId}`),
  placeBet: (data) => api.post('/bets', data),
  doubleBet: (match_id) => api.post('/bets/double', { match_id }),
  extraTimeBet: (match_id, winner) => api.post('/bets/extra-time', { match_id, winner }),
};

export const statsApi = {
  leaderboard: () => api.get('/leaderboard'),
  myStats: () => api.get('/stats/me'),
  pending: () => api.get('/notifications/pending'),
};

export default api;
