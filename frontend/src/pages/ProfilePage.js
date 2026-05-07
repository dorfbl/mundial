import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { statsApi } from '../api';
import { useAuth } from '../AuthContext';

export default function ProfilePage() {
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([statsApi.myStats(), statsApi.leaderboard()]).then(([s, l]) => {
      setStats(s.data); setLeaderboard(l.data); setLoading(false);
    });
  }, []);

  function handleLogout() { logout(); navigate('/login'); }

  if (loading) return <div className="empty-state" style={{paddingTop:80}}><div className="icon">⏳</div></div>;

  const myRank = leaderboard.findIndex(r => r.id === user?.id) + 1;
  const accuracy = stats.total_bets > 0 ? Math.round((stats.correct_bets / stats.total_bets) * 100) : 0;

  const weeklyBest = leaderboard[0];
  const worstPlayer = [...leaderboard].sort((a,b) => a.total_points - b.total_points)[0];

  const groupDoubled = stats.doubledBets?.find(d => d.bet_type === 'group');
  const knockoutDoubled = stats.doubledBets?.find(d => d.bet_type === 'knockout');

  return (
    <div style={{paddingBottom:80}}>
      <div className="page-header">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <h1>👤 {user?.display_name}</h1>
            <div className="subtitle">
              {myRank > 0 ? `מקום ${myRank} מתוך ${leaderboard.length}` : 'הפרופיל שלך'}
            </div>
          </div>
          <button onClick={handleLogout} style={{background:'none',border:'1px solid var(--border)',color:'var(--text3)',padding:'6px 12px',borderRadius:8,cursor:'pointer',fontSize:12}}>
            יציאה
          </button>
        </div>
      </div>

      {/* Streak */}
      {stats.streak > 0 && (
        <div style={{margin:'12px 16px', background:'linear-gradient(135deg, rgba(245,200,66,0.15), rgba(245,200,66,0.05))', border:'1px solid rgba(245,200,66,0.3)', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12}}>
          <div style={{fontSize:32}}>🔥</div>
          <div>
            <div style={{fontWeight:800, color:'var(--gold)'}}>רצף של {stats.streak} משחקים!</div>
            <div style={{fontSize:12, color:'var(--text2)'}}>ניחשת נכון ברצף</div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{color:'var(--gold)'}}>{stats.total_points}</div>
          <div className="stat-label">סה״כ נקודות</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{color:'var(--blue)'}}>{myRank || '—'}</div>
          <div className="stat-label">מקום בטבלה</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{color:'var(--green)'}}>{stats.exact}</div>
          <div className="stat-label">תוצאה מדויקת 🎯</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{accuracy}%</div>
          <div className="stat-label">אחוז דיוק</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{color:'var(--green)'}}>{stats.correct_diff}</div>
          <div className="stat-label">הפרש נכון</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{color:'var(--blue)'}}>{stats.correct_winner}</div>
          <div className="stat-label">מנצח נכון</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{color:'var(--red)'}}>{stats.wrong}</div>
          <div className="stat-label">החמצות</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_bets}</div>
          <div className="stat-label">סה״כ הימורים</div>
        </div>
      </div>

      {/* Doubled bets status */}
      <div style={{padding:'0 16px'}}>
        <div style={{fontSize:15, fontWeight:800, marginBottom:10}}>הכפלות</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
          <div style={{background:'var(--card)', border:`1px solid ${groupDoubled?'var(--text3)':'var(--gold)'}`, borderRadius:12, padding:14}}>
            <div style={{fontSize:20, marginBottom:4}}>✕2</div>
            <div style={{fontWeight:700, fontSize:13}}>שלב הבתים</div>
            <div style={{fontSize:11, color: groupDoubled?'var(--text3)':'var(--gold)', marginTop:4}}>
              {groupDoubled ? '✅ שומש' : '⭐ זמין'}
            </div>
          </div>
          <div style={{background:'var(--card)', border:`1px solid ${knockoutDoubled?'var(--text3)':'var(--gold)'}`, borderRadius:12, padding:14}}>
            <div style={{fontSize:20, marginBottom:4}}>✕2</div>
            <div style={{fontWeight:700, fontSize:13}}>פלייאוף</div>
            <div style={{fontSize:11, color: knockoutDoubled?'var(--text3)':'var(--gold)', marginTop:4}}>
              {knockoutDoubled ? '✅ שומש' : '⭐ זמין'}
            </div>
          </div>
        </div>
      </div>

      {/* Fun awards */}
      {(weeklyBest || worstPlayer) && (
        <div style={{padding:'16px 16px 0'}}>
          <div style={{fontSize:15, fontWeight:800, marginBottom:10}}>פרסים 😄</div>
          {weeklyBest && (
            <div style={{background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:12}}>
              <div style={{fontSize:24}}>👑</div>
              <div>
                <div style={{fontWeight:700, color:'var(--gold)'}}>מלך המונדיאל</div>
                <div style={{fontSize:13, color:'var(--text2)'}}>{weeklyBest.display_name} · {weeklyBest.total_points} נקודות</div>
              </div>
            </div>
          )}
          {worstPlayer && worstPlayer.id !== weeklyBest?.id && (
            <div style={{background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:12}}>
              <div style={{fontSize:24}}>🤦</div>
              <div>
                <div style={{fontWeight:700, color:'var(--red)'}}>מלך ההחמצות</div>
                <div style={{fontSize:13, color:'var(--text2)'}}>{worstPlayer.display_name} · {worstPlayer.total_points} נקודות</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
