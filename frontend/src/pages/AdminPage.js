import React, { useState, useEffect } from 'react';
import { matchesApi } from '../api';
import { formatKickoff, isFinished } from '../utils/matchHelpers';

export default function AdminPage() {
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ home_score:'', away_score:'', status:'FINISHED', winner_et:'', home_score_et:'', away_score_et:'' });
  const [msg, setMsg] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { matchesApi.getAll().then(r => setMatches(r.data)); }, []);

  function selectMatch(m) {
    setSelected(m);
    setForm({
      home_score: m.home_score ?? '',
      away_score: m.away_score ?? '',
      status: m.status || 'FINISHED',
      winner_et: m.winner_et || '',
      home_score_et: m.home_score_et ?? '',
      away_score_et: m.away_score_et ?? '',
    });
    setMsg(null);
  }

  async function saveResult() {
    try {
      await matchesApi.updateResult(selected.id, {
        home_score: parseInt(form.home_score),
        away_score: parseInt(form.away_score),
        status: form.status,
        winner_et: form.winner_et || null,
        home_score_et: form.home_score_et !== '' ? parseInt(form.home_score_et) : null,
        away_score_et: form.away_score_et !== '' ? parseInt(form.away_score_et) : null,
      });
      setMsg({ type:'success', text:'✅ תוצאה נשמרה וניקוד עודכן!' });
      matchesApi.getAll().then(r => setMatches(r.data));
    } catch (e) {
      setMsg({ type:'error', text: e.response?.data?.error || 'שגיאה' });
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      await matchesApi.sync();
      matchesApi.getAll().then(r => setMatches(r.data));
      setMsg({ type:'success', text:'✅ סנכרון הצליח!' });
    } catch { setMsg({ type:'error', text:'שגיאה בסנכרון' }); }
    finally { setSyncing(false); }
  }

  return (
    <div style={{paddingBottom:80}}>
      <div className="page-header">
        <h1>⚙️ פאנל מנהל</h1>
        <div className="subtitle">עדכון תוצאות וסנכרון</div>
      </div>

      <div style={{padding:'12px 16px'}}>
        <button className="btn btn-secondary" onClick={sync} disabled={syncing}>
          {syncing ? '⏳ מסנכרן...' : '🔄 סנכרן מ-API'}
        </button>
        {msg && <div className={`alert alert-${msg.type} mt-8`}>{msg.text}</div>}
      </div>

      {selected && (
        <div style={{margin:'0 16px 16px', background:'var(--card)', border:'1px solid var(--gold)', borderRadius:14, padding:16}}>
          <div style={{fontWeight:800, marginBottom:12}}>
            {selected.home_flag} {selected.home_team} נגד {selected.away_team} {selected.away_flag}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'center', marginBottom:12}}>
            <input className="input" type="number" min="0" value={form.home_score} onChange={e=>setForm(f=>({...f,home_score:e.target.value}))} placeholder="0"/>
            <span style={{textAlign:'center', color:'var(--text3)'}}>:</span>
            <input className="input" type="number" min="0" value={form.away_score} onChange={e=>setForm(f=>({...f,away_score:e.target.value}))} placeholder="0"/>
          </div>

          <label className="input-label">סטטוס</label>
          <select className="input" style={{marginBottom:12}} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
            <option value="SCHEDULED">SCHEDULED - מתוכנן</option>
            <option value="IN_PLAY">IN_PLAY - משחק חי</option>
            <option value="PAUSED">PAUSED - הפסקה</option>
            <option value="FINISHED">FINISHED - הסתיים</option>
          </select>

          {selected.is_knockout ? (
            <>
              <label className="input-label">מנצח בהארכה/פנדלים (אם היה)</label>
              <select className="input" style={{marginBottom:8}} value={form.winner_et} onChange={e=>setForm(f=>({...f,winner_et:e.target.value}))}>
                <option value="">ללא הארכה</option>
                <option value="HOME_TEAM">{selected.home_team}</option>
                <option value="AWAY_TEAM">{selected.away_team}</option>
              </select>
            </>
          ) : null}

          <button className="btn btn-primary mt-8" onClick={saveResult}>💾 שמור תוצאה</button>
          <button className="btn btn-outline mt-8" onClick={() => setSelected(null)}>ביטול</button>
        </div>
      )}

      <div className="section-header">כל המשחקים</div>
      {matches.map(m => (
        <div key={m.id} style={{margin:'4px 16px', background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center'}}
          onClick={() => selectMatch(m)}>
          <div>
            <div style={{fontSize:13, fontWeight:700}}>{m.home_flag}{m.home_team} נגד {m.away_team}{m.away_flag}</div>
            <div style={{fontSize:11, color:'var(--text3)', marginTop:2}}>{m.group_name||m.stage} · {formatKickoff(m.kickoff)}</div>
          </div>
          <div style={{textAlign:'left'}}>
            {m.home_score != null ? (
              <span style={{fontWeight:800, color:'var(--gold)'}}>{m.home_score}–{m.away_score}</span>
            ) : (
              <span style={{color:'var(--text3)', fontSize:12}}>ללא תוצאה</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
