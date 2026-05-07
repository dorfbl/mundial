import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { matchesApi, betsApi } from '../api';
import { formatKickoff, isBettingOpen, isLive, isFinished, scoreStr, getPointsColor } from '../utils/matchHelpers';
import { useAuth } from '../AuthContext';
import { FlagImg } from './MatchesPage';

export default function MatchDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [match, setMatch] = useState(null);
  const [betData, setBetData] = useState(null);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showEt, setShowEt] = useState(false);
  const [etWinner, setEtWinner] = useState(null);
  const [doubledUsed, setDoubledUsed] = useState({group: false, knockout: false});

  const load = useCallback(async () => {
    try {
      const [mRes, bRes] = await Promise.all([
        matchesApi.getOne(id),
        betsApi.getForMatch(id),
      ]);
      setMatch(mRes.data);
      setBetData(bRes.data);
      if (bRes.data.myBet) {
        setHomeScore(bRes.data.myBet.home_score);
        setAwayScore(bRes.data.myBet.away_score);
      }
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Check doubled status
  useEffect(() => {
    if (!betData) return;
    const myBet = betData.myBet;
    // We check from the bet itself
  }, [betData]);

  // Show ET modal if live and draw
  useEffect(() => {
    if (!match) return;
    if (isLive(match) && match.home_score === match.away_score && match.is_knockout) {
      setShowEt(true);
    }
  }, [match]);

  async function saveBet() {
    setSaving(true); setMsg(null);
    try {
      await betsApi.placeBet({ match_id: parseInt(id), home_score: homeScore, away_score: awayScore });
      setMsg({ type: 'success', text: '✅ הימור נשמר!' });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'שגיאה' });
    } finally { setSaving(false); }
  }

  async function doubleBet() {
    try {
      await betsApi.doubleBet(parseInt(id));
      setMsg({ type: 'success', text: '✅ הימור הוכפל!' });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'שגיאה' });
    }
  }

  async function submitEt(winner) {
    try {
      await betsApi.extraTimeBet(parseInt(id), winner);
      setMsg({ type: 'success', text: '✅ הימור הארכה נשמר! +1 נקודה אם תצדק' });
      setShowEt(false);
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'שגיאה' });
      setShowEt(false);
    }
  }

  if (loading) return <div className="empty-state" style={{paddingTop:80}}><div className="icon">⏳</div></div>;
  if (!match) return <div className="empty-state"><div className="icon">❌</div><p>משחק לא נמצא</p></div>;

  const open = isBettingOpen(match);
  const live = isLive(match);
  const finished = isFinished(match);
  const myBet = betData?.myBet;
  const allBets = betData?.allBets;
  const betType = match.is_knockout ? 'knockout' : 'group';
  const isDoubled = myBet?.is_doubled === 1;

  return (
    <div style={{paddingBottom: 100}}>
      {/* ET Modal */}
      {showEt && live && match.is_knockout && (
        <div className="modal-overlay" onClick={() => setShowEt(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-header">
              <div style={{fontSize:13, color:'var(--red)', fontWeight:700, marginBottom:4}}>🔴 תיקו ב-90 דקות!</div>
              <div style={{fontSize:20, fontWeight:900}}>הימור הארכה</div>
              <div style={{fontSize:13, color:'var(--text2)', marginTop:4}}>מי יעפיל הלאה? +1 נקודה</div>
            </div>
            <div className="modal-body">
              <div className="et-choice">
                <button className={`et-btn ${etWinner==='home'?'selected':''}`} onClick={() => setEtWinner('home')}>
                  <span className="flag"><FlagImg code={match.home_team_code} size={32} alt={match.home_team} /></span>
                  {match.home_team}
                </button>
                <button className={`et-btn ${etWinner==='away'?'selected':''}`} onClick={() => setEtWinner('away')}>
                  <span className="flag"><FlagImg code={match.away_team_code} size={32} alt={match.away_team} /></span>
                  {match.away_team}
                </button>
              </div>
              <button className="btn btn-primary" disabled={!etWinner} onClick={() => submitEt(etWinner)}>
                שלח הימור הארכה
              </button>
              <button className="btn btn-outline mt-8" onClick={() => setShowEt(false)}>אחר כך</button>
            </div>
          </div>
        </div>
      )}

      {/* Back button */}
      <div style={{padding:'16px 16px 0', display:'flex', alignItems:'center', gap:8}}>
        <button onClick={() => navigate(-1)} style={{background:'none',border:'none',color:'var(--gold)',fontSize:24,cursor:'pointer'}}>‹</button>
        <span style={{fontSize:13, color:'var(--text2)'}}>{match.group_name || match.stage}</span>
      </div>

      {/* Match header */}
      <div style={{padding:'16px 20px', textAlign:'center'}}>
        <div style={{display:'flex', justifyContent:'center', alignItems:'center', gap:20}}>
          <div className="team" style={{minWidth:80}}>
            <div style={{display:'flex', justifyContent:'center'}}><FlagImg code={match.home_team_code} size={52} alt={match.home_team} /></div>
            <div style={{fontSize:15, fontWeight:800, marginTop:6}}>{match.home_team}</div>
          </div>
          <div style={{textAlign:'center'}}>
            {live || finished ? (
              <div style={{fontSize:40, fontWeight:900, color:'var(--gold)', letterSpacing:4}}>
                {scoreStr(match.home_score, match.away_score)}
              </div>
            ) : (
              <div style={{fontSize:16, color:'var(--text2)', fontWeight:700}}>נגד</div>
            )}
            {live && <div className="live-badge" style={{margin:'8px auto', width:'fit-content'}}><span className="live-dot"/>משחק חי</div>}
          </div>
          <div className="team" style={{minWidth:80}}>
            <div style={{display:'flex', justifyContent:'center'}}><FlagImg code={match.away_team_code} size={52} alt={match.away_team} /></div>
            <div style={{fontSize:15, fontWeight:800, marginTop:6}}>{match.away_team}</div>
          </div>
        </div>
        <div style={{marginTop:12, fontSize:13, color:'var(--text2)'}}>📅 {formatKickoff(match.kickoff)}</div>
        {finished && match.winner_et && match.winner_et !== 'DRAW' && (
          <div style={{marginTop:8, fontSize:12, color:'var(--purple)', background:'rgba(168,85,247,0.1)', padding:'4px 12px', borderRadius:20, display:'inline-block'}}>
            ⚡ הוכרע בהארכה/פנדלים
          </div>
        )}
      </div>

      <hr className="divider" style={{margin:'0 16px'}}/>

      {/* Betting section */}
      {open && (
        <div style={{padding:'16px 20px'}}>
          <div style={{fontSize:16, fontWeight:800, marginBottom:4}}>הימור שלך</div>
          <div style={{fontSize:12, color:'var(--text3)', marginBottom:16}}>ניתן לשנות עד 5 דקות לפני המשחק</div>

          <div className="score-input-row">
            <div className="score-input-group">
              <div className="score-input-label">{match.home_team}</div>
              <div className="score-stepper">
                <button onClick={() => setHomeScore(Math.max(0, homeScore-1))}>−</button>
                <input type="number" min="0" max="20" value={homeScore} onChange={e => setHomeScore(Math.max(0,parseInt(e.target.value)||0))} readOnly/>
                <button onClick={() => setHomeScore(homeScore+1)}>+</button>
              </div>
            </div>
            <div className="score-dash">:</div>
            <div className="score-input-group">
              <div className="score-input-label">{match.away_team}</div>
              <div className="score-stepper">
                <button onClick={() => setAwayScore(Math.max(0, awayScore-1))}>−</button>
                <input type="number" min="0" max="20" value={awayScore} onChange={e => setAwayScore(Math.max(0,parseInt(e.target.value)||0))} readOnly/>
                <button onClick={() => setAwayScore(awayScore+1)}>+</button>
              </div>
            </div>
          </div>

          {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

          <button className="btn btn-primary" onClick={saveBet} disabled={saving}>
            {saving ? '...' : myBet ? '✏️ עדכן הימור' : '🎯 שמור הימור'}
          </button>

          {myBet && !isDoubled && (
            <button className="btn btn-double mt-8" onClick={doubleBet}>
              ✕2 הכפל הימור ({betType === 'group' ? 'שלב בתים' : 'פלייאוף'})
            </button>
          )}
          {isDoubled && (
            <div className="alert alert-warning mt-8">✕2 הימור זה מוכפל!</div>
          )}
        </div>
      )}

      {/* My result when closed/finished */}
      {!open && myBet && (
        <div style={{padding:'16px 20px'}}>
          <div style={{fontSize:13, color:'var(--text2)', marginBottom:8}}>הניחוש שלי</div>
          <div style={{display:'flex', alignItems:'center', gap:12, background:'var(--card)', borderRadius:12, padding:'14px 16px', border:'1px solid var(--border)'}}>
            <div style={{fontSize:22, fontWeight:900, color:'var(--gold)', letterSpacing:2}}>
              {myBet.home_score}–{myBet.away_score}
            </div>
            {myBet.is_doubled ? <span className="double-badge" style={{position:'static'}}>✕2</span> : null}
            {finished && myBet.points != null ? (
              <div style={{marginRight:'auto', textAlign:'center'}}>
                <div style={{fontSize:24, fontWeight:900, color: myBet.points>0?'var(--gold)':'var(--text3)'}}>
                  {myBet.points} נק׳
                </div>
              </div>
            ) : null}
          </div>
          {!myBet && <div className="alert alert-error mt-8">לא הימרת על משחק זה</div>}
        </div>
      )}

      {!open && !myBet && (
        <div style={{padding:'0 20px'}}>
          <div className="alert alert-error">לא הימרת על משחק זה</div>
        </div>
      )}

      {/* All bets - visible after kickoff */}
      {!betData?.isOpen && allBets && allBets.length > 0 && (
        <div style={{padding:'0 16px'}}>
          <div style={{fontSize:15, fontWeight:800, padding:'16px 4px 8px'}}>ניחושי כולם</div>
          <div className="card">
            <table className="bets-table">
              <tbody>
                {allBets.map(b => (
                  <tr key={b.id} style={{opacity: b.user_id === parseInt(user?.id) ? 1 : 0.85}}>
                    <td style={{fontWeight: b.user_id === parseInt(user?.id) ? 700 : 400}}>
                      {b.user_id === parseInt(user?.id) ? '👤 ' : ''}{b.display_name}
                    </td>
                    <td style={{fontWeight:700, textAlign:'center'}}>
                      {b.home_score}–{b.away_score}
                      {b.is_doubled ? <span style={{fontSize:10, background:'var(--gold)', color:'#000', borderRadius:4, padding:'1px 4px', marginRight:4}}>✕2</span> : null}
                    </td>
                    <td>
                      {finished && b.points != null ? (
                        <span style={{fontWeight:800, color: getPointsColor(b.points)}}>{b.points} נק׳</span>
                      ) : <span style={{color:'var(--text3)'}}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {betData?.isOpen && (
        <div style={{padding:'0 20px 20px'}}>
          <div className="alert alert-info">ניחושי החברים יוצגו לאחר תחילת המשחק</div>
        </div>
      )}
    </div>
  );
}
