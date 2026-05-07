import React, { useState, useEffect } from 'react';
import { statsApi } from '../api';
import { useAuth } from '../AuthContext';

const MEDALS = ['🥇','🥈','🥉'];

export default function LeaderboardPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    statsApi.leaderboard().then(r => { setRows(r.data); setLoading(false); });
    const t = setInterval(() => statsApi.leaderboard().then(r => setRows(r.data)), 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="empty-state" style={{paddingTop:80}}><div className="icon">⏳</div></div>;

  const maxPts = rows[0]?.total_points || 1;

  return (
    <div style={{paddingBottom:80}}>
      <div className="page-header">
        <h1>🏅 טבלת ניקוד</h1>
        <div className="subtitle">{rows.length} משתתפים</div>
      </div>

      {/* Top 3 podium */}
      {rows.length >= 3 && (
        <div style={{padding:'20px 16px 8px', display:'flex', justifyContent:'center', gap:8, alignItems:'flex-end'}}>
          {/* 2nd */}
          <Podium rank={2} row={rows[1]} isMe={rows[1]?.id === user?.id} height={90}/>
          {/* 1st */}
          <Podium rank={1} row={rows[0]} isMe={rows[0]?.id === user?.id} height={120}/>
          {/* 3rd */}
          <Podium rank={3} row={rows[2]} isMe={rows[2]?.id === user?.id} height={70}/>
        </div>
      )}

      <div className="leaderboard">
        {rows.map((row, i) => (
          <div key={row.id} className={`lb-row ${row.id === user?.id ? 'me' : ''}`}>
            <div className={`lb-rank ${i<3?`rank-${i+1}`:''}`}>
              {i < 3 ? MEDALS[i] : i + 1}
            </div>
            <div style={{flex:1}}>
              <div className="lb-name">
                {row.id === user?.id ? '👤 ' : ''}{row.display_name}
              </div>
              <div className="lb-sub">
                {row.exact_bets} מדויק · {row.total_bets} הימורים
                {row.id === user?.id ? ' · אתה' : ''}
              </div>
              {/* Progress bar */}
              <div style={{marginTop:6, background:'var(--border)', borderRadius:3, height:3}}>
                <div style={{
                  background: row.id===user?.id ? 'var(--gold)' : 'var(--blue)',
                  width: `${Math.round((row.total_points/maxPts)*100)}%`,
                  height:'100%', borderRadius:3, transition:'width 0.5s'
                }}/>
              </div>
            </div>
            <div style={{textAlign:'left'}}>
              <div className="lb-points">{row.total_points}</div>
              <div className="lb-pts-label">נקודות</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Podium({ rank, row, isMe, height }) {
  const colors = { 1:'var(--gold)', 2:'#c0c0c0', 3:'#cd7f32' };
  return (
    <div style={{flex:1, textAlign:'center', maxWidth:120}}>
      <div style={{fontSize:28, marginBottom:4}}>{row?.home_flag || '👤'}</div>
      <div style={{fontSize:12, fontWeight:700, marginBottom:6, color: isMe?'var(--gold)':'var(--text)'}}>{row?.display_name}</div>
      <div style={{
        height, background:`linear-gradient(to top, ${colors[rank]}22, ${colors[rank]}11)`,
        border:`1px solid ${colors[rank]}44`, borderRadius:'8px 8px 0 0',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2
      }}>
        <div style={{fontSize:22, fontWeight:900, color:colors[rank]}}>{row?.total_points}</div>
        <div style={{fontSize:10, color:'var(--text3)'}}>נק׳</div>
      </div>
    </div>
  );
}
