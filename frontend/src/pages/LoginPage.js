import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useAuth } from '../AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [adminMode, setAdminMode] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin() {
    if (!username.trim()) return setError('הכנס שם משתמש');
    setLoading(true); setError('');
    try {
      const res = await authApi.login(username);
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (e) {
      setError(e.response?.data?.error || 'שגיאה בהתחברות');
    } finally { setLoading(false); }
  }

  async function handleAdminLogin() {
    setLoading(true); setError('');
    try {
      const res = await authApi.adminLogin(password);
      login(res.data.token, res.data.user);
      navigate('/admin');
    } catch (e) {
      setError('סיסמה שגויה');
    } finally { setLoading(false); }
  }

  return (
    <div className="login-page">
      <div className="login-logo">🏆</div>
      <h1 className="login-title">מונדיאל 2026</h1>
      <p className="login-sub">הימורים בין חברים</p>

      <div className="login-card">
        {!adminMode ? (
          <>
            <label className="input-label">שם משתמש</label>
            <input
              className="input"
              placeholder="הכנס את שמך..."
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoFocus
            />
            {error && <div className="alert alert-error mt-8">{error}</div>}
            <button className="btn btn-primary mt-16" onClick={handleLogin} disabled={loading}>
              {loading ? '...' : '🚀 כניסה'}
            </button>
            <button className="btn btn-outline mt-8" style={{fontSize:12}} onClick={() => setAdminMode(true)}>
              כניסת מנהל
            </button>
          </>
        ) : (
          <>
            <label className="input-label">סיסמת מנהל</label>
            <input
              className="input"
              type="password"
              placeholder="סיסמה..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              autoFocus
            />
            {error && <div className="alert alert-error mt-8">{error}</div>}
            <button className="btn btn-primary mt-16" onClick={handleAdminLogin} disabled={loading}>
              {loading ? '...' : '🔐 כניסת מנהל'}
            </button>
            <button className="btn btn-outline mt-8" onClick={() => setAdminMode(false)}>
              חזרה
            </button>
          </>
        )}
      </div>
    </div>
  );
}
